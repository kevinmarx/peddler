import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { AppConfig, SecretsConfig } from '../types';

export class ConfigService {
  private ssmClient: SSMClient;
  private secretsClient: SecretsManagerClient;
  private configCache: AppConfig | null = null;
  private secretsCache: SecretsConfig | null = null;
  private cacheExpiry: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.ssmClient = new SSMClient({ region: process.env.AWS_REGION });
    this.secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION });
  }

  async getConfig(): Promise<AppConfig> {
    if (this.configCache && Date.now() < this.cacheExpiry) {
      return this.configCache;
    }

    try {
      const parameterName = process.env.CONFIG_PARAMETER;
      if (!parameterName) {
        throw new Error('CONFIG_PARAMETER environment variable not set');
      }

      const command = new GetParameterCommand({
        Name: parameterName,
        WithDecryption: true,
      });

      const response = await this.ssmClient.send(command);

      if (!response.Parameter?.Value) {
        throw new Error('Configuration parameter not found or empty');
      }

      this.configCache = JSON.parse(response.Parameter.Value);
      this.cacheExpiry = Date.now() + this.CACHE_TTL;

      return this.configCache!;
    } catch (error) {
      console.error('Failed to load configuration:', error);
      throw error;
    }
  }

  async getSecrets(): Promise<SecretsConfig> {
    if (this.secretsCache && Date.now() < this.cacheExpiry) {
      return this.secretsCache;
    }

    try {
      const secretName = process.env.SECRETS_NAME;
      if (!secretName) {
        throw new Error('SECRETS_NAME environment variable not set');
      }

      const command = new GetSecretValueCommand({
        SecretId: secretName,
      });

      const response = await this.secretsClient.send(command);

      if (!response.SecretString) {
        throw new Error('Secrets not found or empty');
      }

      this.secretsCache = JSON.parse(response.SecretString);
      this.cacheExpiry = Date.now() + this.CACHE_TTL;

      return this.secretsCache!;
    } catch (error) {
      console.error('Failed to load secrets:', error);
      throw error;
    }
  }

  async getEnabledScrapers(): Promise<AppConfig['scrapers']> {
    const config = await this.getConfig();
    return config.scrapers.filter(scraper => scraper.enabled);
  }
}
