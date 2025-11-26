/**
 * Unit Tests for AI Decision Engine
 *
 * Tests prompt building, response parsing, validation, and decision logic.
 */

const AIDecisionEngine = require('../../../lib/ai/decision');
const OllamaClient = require('../../../lib/ai/ollama_client');
const { buildPrompt, buildSetupData, validateSetupData, buildTestPrompt } = require('../../../lib/ai/prompts');

// Mock Ollama Client
class MockOllamaClient {
  constructor() {
    this.responses = [];
    this.currentResponseIndex = 0;
  }

  setResponse(response) {
    this.responses = [response];
    this.currentResponseIndex = 0;
  }

  setResponses(responses) {
    this.responses = responses;
    this.currentResponseIndex = 0;
  }

  async generate(prompt, options) {
    const response = this.responses[this.currentResponseIndex];
    this.currentResponseIndex = (this.currentResponseIndex + 1) % this.responses.length;
    return response;
  }

  async isAvailable() {
    return true;
  }
}

describe('AI Decision Engine Tests', () => {
  describe('Prompt Building', () => {
    test('buildSetupData should create complete setup data', () => {
      const confluenceState = {
        id: 1,
        sweep_id: 1,
        bias: 'BULLISH',
        choch_price: '89500',
        choch_time: '2025-11-26T10:00:00Z',
        fvg_zone_low: '89200',
        fvg_zone_high: '89800',
        fvg_fill_price: '89500',
        fvg_fill_time: '2025-11-26T10:15:00Z',
        bos_price: '90200',
        bos_time: '2025-11-26T10:30:00Z'
      };

      const sweepData = {
        sweep_type: 'LOW',
        price: '89000',
        bias: 'BULLISH',
        swing_level: '89000'
      };

      const swingData = {
        swing5M: {
          swing_type: 'LOW',
          price: 89100,
          timestamp: '2025-11-26T10:25:00Z'
        },
        swing4H: {
          swing_type: 'LOW',
          price: 89000,
          timestamp: '2025-11-26T08:00:00Z'
        },
        recommendedStop: 88920,
        stopDistancePercent: 1.2,
        minimumTakeProfit: 92160
      };

      const marketData = {
        currentPrice: 90000
      };

      const accountData = {
        accountBalance: 10000,
        openPositions: 0,
        winRate: 85,
        consecutiveLosses: 0
      };

      const setupData = buildSetupData(
        confluenceState,
        sweepData,
        swingData,
        marketData,
        accountData
      );

      expect(setupData.bias).toBe('BULLISH');
      expect(setupData.direction).toBe('LONG');
      expect(setupData.currentPrice).toBe(90000);
      expect(setupData.recommendedStop).toBe(88920);
      expect(setupData.accountBalance).toBe(10000);
    });

    test('validateSetupData should detect missing fields', () => {
      const incompleteSetupData = {
        sweepType: 'LOW',
        bias: 'BULLISH',
        // Missing many required fields
      };

      const validation = validateSetupData(incompleteSetupData);

      expect(validation.valid).toBe(false);
      expect(validation.missingFields.length).toBeGreaterThan(0);
    });

    test('buildPrompt should generate complete prompt', () => {
      const setupData = {
        sweepType: 'LOW',
        sweepPrice: 89000,
        bias: 'BULLISH',
        swingLevel: 89000,
        chochPrice: 89500,
        chochTime: '2025-11-26T10:00:00Z',
        fvgLow: 89200,
        fvgHigh: 89800,
        fvgFillPrice: 89500,
        fvgFillTime: '2025-11-26T10:15:00Z',
        bosPrice: 90200,
        bosTime: '2025-11-26T10:30:00Z',
        currentPrice: 90000,
        accountBalance: 10000,
        swing5MType: 'LOW',
        swing5MPrice: 89100,
        swing5MTime: '2025-11-26T10:25:00Z',
        swing4HType: 'LOW',
        swing4HPrice: 89000,
        swing4HTime: '2025-11-26T08:00:00Z',
        recommendedStop: 88920,
        stopDistancePercent: '1.20',
        openPositions: 0,
        winRate: '85.00',
        consecutiveLosses: 0,
        direction: 'LONG',
        minimumTakeProfit: 92160
      };

      const prompt = buildPrompt(setupData);

      expect(prompt).toContain('GOAL: Achieve 90% win rate');
      expect(prompt).toContain('BULLISH');
      expect(prompt).toContain('LONG');
      expect(prompt).toContain('$90000');
      expect(prompt).toContain('Response ONLY the JSON object');
    });
  });

  describe('AI Response Parsing', () => {
    test('parseAIResponse should extract JSON from text', () => {
      const engine = new AIDecisionEngine({
        ollama: {},
        db: {},
        coinbaseClient: {}
      });

      const responseText = `Here is my analysis:
{
  "trade_decision": "YES",
  "direction": "LONG",
  "entry_price": 90000,
  "stop_loss": 88920,
  "stop_loss_source": "5M_SWING",
  "take_profit": 92160,
  "position_size_btc": 0.037,
  "risk_reward_ratio": 2.0,
  "confidence": 75,
  "reasoning": "All confluences aligned properly"
}
That's my decision.`;

      const parsed = engine.parseAIResponse(responseText);

      expect(parsed).toBeDefined();
      expect(parsed.trade_decision).toBe('YES');
      expect(parsed.direction).toBe('LONG');
      expect(parsed.confidence).toBe(75);
    });

    test('parseAIResponse should handle pure JSON', () => {
      const engine = new AIDecisionEngine({
        ollama: {},
        db: {},
        coinbaseClient: {}
      });

      const responseText = JSON.stringify({
        trade_decision: 'NO',
        direction: 'LONG',
        entry_price: 90000,
        stop_loss: 88920,
        stop_loss_source: '5M_SWING',
        take_profit: 92160,
        position_size_btc: 0.037,
        risk_reward_ratio: 2.0,
        confidence: 60,
        reasoning: 'Price action too choppy'
      });

      const parsed = engine.parseAIResponse(responseText);

      expect(parsed).toBeDefined();
      expect(parsed.trade_decision).toBe('NO');
      expect(parsed.reasoning).toContain('choppy');
    });

    test('parseAIResponse should return null for invalid JSON', () => {
      const engine = new AIDecisionEngine({
        ollama: {},
        db: {},
        coinbaseClient: {}
      });

      const responseText = 'This is not JSON at all';

      const parsed = engine.parseAIResponse(responseText);

      expect(parsed).toBeNull();
    });
  });

  describe('AI Decision Validation', () => {
    test('validateAIDecision should accept valid YES decision', () => {
      const engine = new AIDecisionEngine({
        ollama: {},
        db: {},
        coinbaseClient: {}
      });

      const decision = {
        trade_decision: 'YES',
        direction: 'LONG',
        entry_price: 90000,
        stop_loss: 88920,
        take_profit: 92160,
        risk_reward_ratio: 2.0,
        confidence: 75,
        reasoning: 'Valid setup'
      };

      const validation = engine.validateAIDecision(decision);

      expect(validation.valid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });

    test('validateAIDecision should accept valid NO decision', () => {
      const engine = new AIDecisionEngine({
        ollama: {},
        db: {},
        coinbaseClient: {}
      });

      const decision = {
        trade_decision: 'NO',
        direction: 'LONG',
        entry_price: 90000,
        stop_loss: 88920,
        take_profit: 92160,
        risk_reward_ratio: 2.0,
        confidence: 50,
        reasoning: 'Setup not clear enough'
      };

      const validation = engine.validateAIDecision(decision);

      expect(validation.valid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });

    test('validateAIDecision should reject invalid decision type', () => {
      const engine = new AIDecisionEngine({
        ollama: {},
        db: {},
        coinbaseClient: {}
      });

      const decision = {
        trade_decision: 'MAYBE', // Invalid
        direction: 'LONG',
        entry_price: 90000,
        stop_loss: 88920,
        take_profit: 92160,
        risk_reward_ratio: 2.0,
        confidence: 75,
        reasoning: 'Valid setup'
      };

      const validation = engine.validateAIDecision(decision);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    test('validateAIDecision should reject stop on wrong side (LONG)', () => {
      const engine = new AIDecisionEngine({
        ollama: {},
        db: {},
        coinbaseClient: {}
      });

      const decision = {
        trade_decision: 'YES',
        direction: 'LONG',
        entry_price: 90000,
        stop_loss: 91000, // Stop above entry for LONG (wrong!)
        take_profit: 92160,
        risk_reward_ratio: 2.0,
        confidence: 75,
        reasoning: 'Valid setup'
      };

      const validation = engine.validateAIDecision(decision);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('stop_loss must be below entry_price'))).toBe(true);
    });

    test('validateAIDecision should reject stop on wrong side (SHORT)', () => {
      const engine = new AIDecisionEngine({
        ollama: {},
        db: {},
        coinbaseClient: {}
      });

      const decision = {
        trade_decision: 'YES',
        direction: 'SHORT',
        entry_price: 90000,
        stop_loss: 89000, // Stop below entry for SHORT (wrong!)
        take_profit: 87000,
        risk_reward_ratio: 2.0,
        confidence: 75,
        reasoning: 'Valid setup'
      };

      const validation = engine.validateAIDecision(decision);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('stop_loss must be above entry_price'))).toBe(true);
    });

    test('validateAIDecision should reject low R/R ratio', () => {
      const engine = new AIDecisionEngine({
        ollama: {},
        db: {},
        coinbaseClient: {}
      });

      const decision = {
        trade_decision: 'YES',
        direction: 'LONG',
        entry_price: 90000,
        stop_loss: 88920,
        take_profit: 90500, // Too close, R/R < 2:1
        risk_reward_ratio: 0.5, // Invalid
        confidence: 75,
        reasoning: 'Valid setup'
      };

      const validation = engine.validateAIDecision(decision);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('risk_reward_ratio'))).toBe(true);
    });

    test('validateAIDecision should reject invalid confidence', () => {
      const engine = new AIDecisionEngine({
        ollama: {},
        db: {},
        coinbaseClient: {}
      });

      const decision = {
        trade_decision: 'YES',
        direction: 'LONG',
        entry_price: 90000,
        stop_loss: 88920,
        take_profit: 92160,
        risk_reward_ratio: 2.0,
        confidence: 150, // Invalid (> 100)
        reasoning: 'Valid setup'
      };

      const validation = engine.validateAIDecision(decision);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('confidence'))).toBe(true);
    });

    test('validateAIDecision should require reasoning', () => {
      const engine = new AIDecisionEngine({
        ollama: {},
        db: {},
        coinbaseClient: {}
      });

      const decision = {
        trade_decision: 'YES',
        direction: 'LONG',
        entry_price: 90000,
        stop_loss: 88920,
        take_profit: 92160,
        risk_reward_ratio: 2.0,
        confidence: 75
        // Missing reasoning
      };

      const validation = engine.validateAIDecision(decision);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('reasoning'))).toBe(true);
    });
  });

  describe('Ollama Client', () => {
    test('OllamaClient should initialize with defaults', () => {
      const client = new OllamaClient();

      expect(client.host).toBe('http://localhost:11434');
      expect(client.model).toBe('gpt-oss:20b');
      expect(client.timeout).toBe(30000);
    });

    test('OllamaClient should accept custom config', () => {
      const client = new OllamaClient({
        host: 'http://custom:11434',
        model: 'llama2',
        timeout: 60000
      });

      expect(client.host).toBe('http://custom:11434');
      expect(client.model).toBe('llama2');
      expect(client.timeout).toBe(60000);
    });
  });

  describe('Test Prompt Builder', () => {
    test('buildTestPrompt should create simple prompt', () => {
      const basicData = {
        direction: 'LONG',
        entry: 90000,
        stop: 88920,
        target: 92160,
        rrRatio: 2.0
      };

      const prompt = buildTestPrompt(basicData);

      expect(prompt).toContain('LONG');
      expect(prompt).toContain('90000');
      expect(prompt).toContain('88920');
      expect(prompt).toContain('92160');
      expect(prompt).toContain('JSON');
    });
  });
});

// Note: Integration tests with real Ollama instance would require:
// 1. Ollama running locally
// 2. gpt-oss:20b model pulled
// 3. Database connection
// 4. Full market data setup
//
// These tests focus on unit testing the logic, parsing, and validation.
