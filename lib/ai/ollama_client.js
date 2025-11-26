/**
 * Ollama API Client
 *
 * Client for interacting with Ollama local LLM for trade decision-making.
 * Supports GPT-OSS 20B model running locally via Ollama.
 */

const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Ollama Client for LLM interactions
 */
class OllamaClient {
  /**
   * @param {Object} config - Configuration options
   * @param {string} config.host - Ollama host URL (default: http://localhost:11434)
   * @param {string} config.model - Model name (default: gpt-oss:20b)
   * @param {number} config.timeout - Request timeout in ms (default: 30000)
   */
  constructor(config = {}) {
    this.host = config.host || process.env.OLLAMA_HOST || 'http://localhost:11434';
    this.model = config.model || process.env.OLLAMA_MODEL || 'gpt-oss:20b';
    this.timeout = config.timeout || 30000; // 30 seconds

    logger.info('Ollama client initialized', {
      host: this.host,
      model: this.model,
      timeout: this.timeout
    });
  }

  /**
   * Generate completion from prompt
   *
   * @param {string} prompt - The prompt to send to the model
   * @param {Object} options - Generation options
   * @param {number} options.temperature - Sampling temperature (default: 0.3)
   * @param {number} options.top_p - Top-p sampling (default: 0.9)
   * @param {number} options.top_k - Top-k sampling (default: 40)
   * @param {number} options.max_tokens - Max tokens to generate (default: 2000)
   * @returns {Promise<string>} Model response
   */
  async generate(prompt, options = {}) {
    const startTime = Date.now();

    try {
      logger.info('Sending request to Ollama', {
        model: this.model,
        promptLength: prompt.length,
        temperature: options.temperature || 0.3
      });

      const response = await axios.post(
        `${this.host}/api/generate`,
        {
          model: this.model,
          prompt: prompt,
          stream: false,
          options: {
            temperature: options.temperature !== undefined ? options.temperature : 0.3,
            top_p: options.top_p !== undefined ? options.top_p : 0.9,
            top_k: options.top_k !== undefined ? options.top_k : 40,
            num_predict: options.max_tokens || 2000,
            stop: options.stop || []
          }
        },
        {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      const duration = Date.now() - startTime;

      if (!response.data || !response.data.response) {
        throw new Error('Invalid response from Ollama API');
      }

      const generatedText = response.data.response;

      logger.info('Ollama response received', {
        duration: `${duration}ms`,
        responseLength: generatedText.length,
        done: response.data.done
      });

      return generatedText;
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('Ollama API request failed', {
        error: error.message,
        duration: `${duration}ms`,
        host: this.host,
        model: this.model
      });

      // Handle specific errors
      if (error.code === 'ECONNREFUSED') {
        throw new Error(`Cannot connect to Ollama at ${this.host}. Is Ollama running?`);
      }

      if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
        throw new Error(`Ollama request timed out after ${this.timeout}ms`);
      }

      if (error.response?.status === 404) {
        throw new Error(`Model ${this.model} not found. Pull it with: ollama pull ${this.model}`);
      }

      throw error;
    }
  }

  /**
   * Check if Ollama is available and the model is loaded
   *
   * @returns {Promise<boolean>} True if available
   */
  async isAvailable() {
    try {
      logger.debug('Checking Ollama availability');

      // Try to list models
      const response = await axios.get(
        `${this.host}/api/tags`,
        {
          timeout: 5000
        }
      );

      if (!response.data || !response.data.models) {
        logger.warn('Ollama responded but no models found');
        return false;
      }

      // Check if our model is available
      const modelExists = response.data.models.some(m => m.name === this.model);

      if (!modelExists) {
        logger.warn('Model not found', {
          model: this.model,
          availableModels: response.data.models.map(m => m.name)
        });
        return false;
      }

      logger.info('Ollama is available', { model: this.model });
      return true;
    } catch (error) {
      logger.error('Ollama availability check failed', {
        error: error.message
      });
      return false;
    }
  }

  /**
   * List available models
   *
   * @returns {Promise<Array>} Array of model objects
   */
  async listModels() {
    try {
      const response = await axios.get(
        `${this.host}/api/tags`,
        {
          timeout: 5000
        }
      );

      return response.data.models || [];
    } catch (error) {
      logger.error('Failed to list models', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Pull a model from Ollama registry
   *
   * @param {string} modelName - Model name to pull
   * @returns {Promise<void>}
   */
  async pullModel(modelName) {
    try {
      logger.info('Pulling model from Ollama', { model: modelName });

      await axios.post(
        `${this.host}/api/pull`,
        {
          name: modelName,
          stream: false
        },
        {
          timeout: 600000 // 10 minutes for model download
        }
      );

      logger.info('Model pulled successfully', { model: modelName });
    } catch (error) {
      logger.error('Failed to pull model', {
        error: error.message,
        model: modelName
      });
      throw error;
    }
  }

  /**
   * Generate embeddings for text (if model supports it)
   *
   * @param {string} text - Text to embed
   * @returns {Promise<Array<number>>} Embedding vector
   */
  async embed(text) {
    try {
      logger.debug('Generating embeddings', { textLength: text.length });

      const response = await axios.post(
        `${this.host}/api/embeddings`,
        {
          model: this.model,
          prompt: text
        },
        {
          timeout: this.timeout
        }
      );

      return response.data.embedding;
    } catch (error) {
      logger.error('Failed to generate embeddings', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Chat completion (for chat models)
   *
   * @param {Array} messages - Array of message objects {role, content}
   * @param {Object} options - Generation options
   * @returns {Promise<string>} Assistant response
   */
  async chat(messages, options = {}) {
    try {
      logger.info('Sending chat request to Ollama', {
        model: this.model,
        messageCount: messages.length
      });

      const response = await axios.post(
        `${this.host}/api/chat`,
        {
          model: this.model,
          messages: messages,
          stream: false,
          options: {
            temperature: options.temperature || 0.3,
            top_p: options.top_p || 0.9,
            top_k: options.top_k || 40
          }
        },
        {
          timeout: this.timeout
        }
      );

      if (!response.data || !response.data.message) {
        throw new Error('Invalid chat response from Ollama API');
      }

      return response.data.message.content;
    } catch (error) {
      logger.error('Chat request failed', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get model information
   *
   * @param {string} modelName - Model name (defaults to configured model)
   * @returns {Promise<Object>} Model info
   */
  async getModelInfo(modelName = null) {
    const model = modelName || this.model;

    try {
      const response = await axios.post(
        `${this.host}/api/show`,
        {
          name: model
        },
        {
          timeout: 5000
        }
      );

      return response.data;
    } catch (error) {
      logger.error('Failed to get model info', {
        error: error.message,
        model
      });
      throw error;
    }
  }
}

module.exports = OllamaClient;
