/**
 * AI Decision Engine
 *
 * Main orchestrator for AI-driven trade decisions.
 * Gathers market data, builds prompts, queries Ollama, and parses responses.
 */

const logger = require('../utils/logger');
const OllamaClient = require('./ollama_client');
const { buildPrompt, buildSetupData, validateSetupData } = require('./prompts');
const { calculatePositionSize } = require('../trading/position_sizer');

// Dynamic imports for ES6 modules
let validateConfluence, calculateStopLoss, getAllSwings, getAccountMetrics;

/**
 * Initialize ES6 module dependencies
 * @private
 */
async function initializeDependencies() {
  if (!validateConfluence) {
    const validatorModule = await import('../scanners/validator.js');
    validateConfluence = validatorModule.validateConfluence;
  }
  if (!calculateStopLoss) {
    const stopModule = await import('../trading/stop_loss_calculator.js');
    calculateStopLoss = stopModule.calculateStopLoss;
  }
  if (!getAllSwings) {
    const swingModule = await import('../trading/swing_selector.js');
    getAllSwings = swingModule.getAllSwings;
  }
  if (!getAccountMetrics) {
    const riskModule = await import('../trading/risk_manager.js');
    getAccountMetrics = riskModule.getAccountMetrics;
  }
}

/**
 * AI Decision Engine
 */
class AIDecisionEngine {
  /**
   * @param {Object} config - Configuration options
   * @param {Object} config.ollama - Ollama client config
   * @param {Object} config.db - Database connection
   * @param {Object} config.coinbaseClient - Coinbase API client
   */
  constructor(config = {}) {
    this.ollamaClient = new OllamaClient(config.ollama);
    this.db = config.db;
    this.coinbaseClient = config.coinbaseClient;

    logger.info('AI Decision Engine initialized');
  }

  /**
   * Make trade decision based on confluence state
   *
   * Complete workflow:
   * 1. Validate confluence pattern
   * 2. Gather market data
   * 3. Calculate swing-based stop loss
   * 4. Build AI prompt
   * 5. Query Ollama for decision
   * 6. Parse and validate response
   * 7. Calculate position size
   * 8. Return complete trade decision
   *
   * @param {number} confluenceId - Confluence state ID
   * @returns {Promise<Object>} Trade decision or rejection
   */
  async makeDecision(confluenceId) {
    await initializeDependencies();

    try {
      logger.info('Making AI trade decision', { confluenceId });

      // ============================================================================
      // Step 1: Get and validate confluence state
      // ============================================================================
      const confluenceState = await this.getConfluenceState(confluenceId);

      if (!confluenceState) {
        throw new Error(`Confluence state ${confluenceId} not found`);
      }

      logger.info('Validating confluence pattern', { confluenceId });

      const validation = validateConfluence(confluenceState);

      if (!validation.valid) {
        logger.warn('Confluence validation failed', {
          confluenceId,
          errors: validation.errors
        });

        return {
          decision: 'NO',
          reason: 'VALIDATION_FAILED',
          errors: validation.errors,
          confluenceId: confluenceId
        };
      }

      logger.info('Confluence validation passed', { confluenceId });

      // ============================================================================
      // Step 2: Gather market data
      // ============================================================================
      logger.info('Gathering market data');

      const currentPrice = await this.coinbaseClient.getCurrentPrice('BTC-USD');
      const accountBalance = await this.getAccountBalance();
      const accountMetrics = await getAccountMetrics(this.db, accountBalance);

      logger.info('Market data gathered', {
        currentPrice,
        accountBalance
      });

      // ============================================================================
      // Step 3: Calculate swing-based stop loss
      // ============================================================================
      const bias = confluenceState.bias;
      const direction = bias === 'BULLISH' ? 'LONG' : 'SHORT';

      logger.info('Calculating swing-based stop loss', {
        direction,
        bias,
        entryPrice: currentPrice
      });

      const stopLossResult = await calculateStopLoss(currentPrice, direction, bias);

      if (!stopLossResult) {
        logger.warn('No valid swing-based stop loss found', {
          confluenceId,
          direction
        });

        return {
          decision: 'NO',
          reason: 'NO_VALID_STOP_LOSS',
          message: 'No swing level provides valid stop loss within 0.5%-3% range with 2:1 R/R',
          confluenceId: confluenceId
        };
      }

      logger.info('Stop loss calculated', {
        stopPrice: stopLossResult.price,
        source: stopLossResult.source,
        distance: stopLossResult.distancePercent
      });

      // ============================================================================
      // Step 4: Get swing data and build setup
      // ============================================================================
      const { swing5M, swing4H } = await getAllSwings(direction);

      const swingData = {
        swing5M,
        swing4H,
        recommendedStop: stopLossResult.price,
        stopDistancePercent: stopLossResult.distancePercent,
        minimumTakeProfit: stopLossResult.minimumTakeProfit,
        stopSource: stopLossResult.source,
        stopSwingPrice: stopLossResult.swingPrice
      };

      // Get sweep data
      const sweepData = await this.getSweepData(confluenceState.sweep_id);

      // Build complete setup data
      const setupData = buildSetupData(
        confluenceState,
        sweepData,
        swingData,
        { currentPrice },
        accountMetrics
      );

      // Validate setup data
      const setupValidation = validateSetupData(setupData);
      if (!setupValidation.valid) {
        throw new Error(`Setup data incomplete: ${setupValidation.missingFields.join(', ')}`);
      }

      // ============================================================================
      // Step 5: Build AI prompt
      // ============================================================================
      const prompt = buildPrompt(setupData);

      logger.info('Prompt built', { promptLength: prompt.length });

      // ============================================================================
      // Step 6: Query Ollama
      // ============================================================================
      logger.info('Querying Ollama for decision');

      const aiResponse = await this.ollamaClient.generate(prompt, {
        temperature: 0.3, // Low temperature for consistent decisions
        top_p: 0.9,
        top_k: 40,
        max_tokens: 2000
      });

      logger.info('AI response received', {
        responseLength: aiResponse.length
      });

      // ============================================================================
      // Step 7: Parse and validate AI response
      // ============================================================================
      const parsedDecision = this.parseAIResponse(aiResponse);

      if (!parsedDecision) {
        throw new Error('Failed to parse AI response as JSON');
      }

      logger.info('AI decision parsed', {
        decision: parsedDecision.trade_decision,
        confidence: parsedDecision.confidence
      });

      // Validate AI decision structure
      const decisionValidation = this.validateAIDecision(parsedDecision);
      if (!decisionValidation.valid) {
        throw new Error(`Invalid AI decision: ${decisionValidation.errors.join(', ')}`);
      }

      // ============================================================================
      // Step 8: Calculate position size
      // ============================================================================
      if (parsedDecision.trade_decision === 'YES') {
        const positionSize = calculatePositionSize(
          accountBalance,
          parsedDecision.entry_price,
          parsedDecision.stop_loss
        );

        // Add position size to decision
        parsedDecision.position_size_btc = positionSize.btc;
        parsedDecision.position_size_usd = positionSize.usd;

        // Add metadata
        parsedDecision.confluence_id = confluenceId;
        parsedDecision.stop_loss_swing_price = stopLossResult.swingPrice;

        logger.info('Trade decision approved', {
          confluenceId,
          direction: parsedDecision.direction,
          confidence: parsedDecision.confidence,
          positionSizeBTC: positionSize.btc
        });
      } else {
        logger.info('Trade decision rejected by AI', {
          confluenceId,
          reasoning: parsedDecision.reasoning
        });
      }

      return parsedDecision;
    } catch (error) {
      logger.error('AI decision failed', {
        error: error.message,
        confluenceId
      });
      throw error;
    }
  }

  /**
   * Parse AI response text to JSON
   *
   * @param {string} responseText - Raw AI response
   * @returns {Object|null} Parsed decision or null
   * @private
   */
  parseAIResponse(responseText) {
    try {
      // Try to find JSON in response (AI might add extra text)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        logger.error('No JSON found in AI response', {
          response: responseText.substring(0, 200)
        });
        return null;
      }

      const jsonStr = jsonMatch[0];
      const parsed = JSON.parse(jsonStr);

      return parsed;
    } catch (error) {
      logger.error('Failed to parse AI response', {
        error: error.message,
        response: responseText.substring(0, 200)
      });
      return null;
    }
  }

  /**
   * Validate AI decision structure
   *
   * @param {Object} decision - Parsed AI decision
   * @returns {Object} { valid: boolean, errors: Array }
   * @private
   */
  validateAIDecision(decision) {
    const errors = [];

    // Required fields
    if (!decision.trade_decision || !['YES', 'NO'].includes(decision.trade_decision)) {
      errors.push('Invalid or missing trade_decision (must be YES or NO)');
    }

    if (!decision.direction || !['LONG', 'SHORT'].includes(decision.direction)) {
      errors.push('Invalid or missing direction (must be LONG or SHORT)');
    }

    if (typeof decision.entry_price !== 'number' || decision.entry_price <= 0) {
      errors.push('Invalid or missing entry_price');
    }

    if (typeof decision.stop_loss !== 'number' || decision.stop_loss <= 0) {
      errors.push('Invalid or missing stop_loss');
    }

    if (typeof decision.take_profit !== 'number' || decision.take_profit <= 0) {
      errors.push('Invalid or missing take_profit');
    }

    if (typeof decision.risk_reward_ratio !== 'number' || decision.risk_reward_ratio < 2.0) {
      errors.push('Invalid or missing risk_reward_ratio (must be >= 2.0)');
    }

    if (typeof decision.confidence !== 'number' || decision.confidence < 0 || decision.confidence > 100) {
      errors.push('Invalid or missing confidence (must be 0-100)');
    }

    if (!decision.reasoning || typeof decision.reasoning !== 'string') {
      errors.push('Missing or invalid reasoning');
    }

    // Validate stop is on correct side
    if (decision.direction === 'LONG' && decision.stop_loss >= decision.entry_price) {
      errors.push('LONG: stop_loss must be below entry_price');
    }

    if (decision.direction === 'SHORT' && decision.stop_loss <= decision.entry_price) {
      errors.push('SHORT: stop_loss must be above entry_price');
    }

    // Validate TP is on correct side
    if (decision.direction === 'LONG' && decision.take_profit <= decision.entry_price) {
      errors.push('LONG: take_profit must be above entry_price');
    }

    if (decision.direction === 'SHORT' && decision.take_profit >= decision.entry_price) {
      errors.push('SHORT: take_profit must be below entry_price');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get confluence state from database
   *
   * @param {number} confluenceId - Confluence ID
   * @returns {Promise<Object>} Confluence state
   * @private
   */
  async getConfluenceState(confluenceId) {
    const dbQueries = await import('../../database/queries.js');
    return dbQueries.getConfluenceState(confluenceId);
  }

  /**
   * Get sweep data from database
   *
   * @param {number} sweepId - Sweep ID
   * @returns {Promise<Object>} Sweep data
   * @private
   */
  async getSweepData(sweepId) {
    const result = await this.db.query(
      'SELECT * FROM liquidity_sweeps WHERE id = $1',
      [sweepId]
    );

    return result.rows[0];
  }

  /**
   * Get account balance
   *
   * @returns {Promise<number>} Account balance in USD
   * @private
   */
  async getAccountBalance() {
    const balanceData = await this.coinbaseClient.getAccountBalance();
    return balanceData.available_balance || balanceData.total_balance || 0;
  }

  /**
   * Check if Ollama is available
   *
   * @returns {Promise<boolean>} True if available
   */
  async checkOllamaAvailable() {
    return this.ollamaClient.isAvailable();
  }
}

module.exports = AIDecisionEngine;
