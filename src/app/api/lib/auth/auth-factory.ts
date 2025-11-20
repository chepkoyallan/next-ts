// Auth provider factory for extensibility
import { JWTAuthProvider } from './providers/jwt-provider';
import { Auth0Provider } from './providers/auth0-provider';
import { OAuth2Provider } from './providers/oauth2-provider';
import { AuthProvider } from './providers/auth-provider-interface';
import { FirebaseAuthProvider } from './providers/firebase-provider';

export class AuthFactory {
  private static providers = new Map<string, AuthProvider>();

  /**
   * Register auth provider
   */
  static registerProvider(name: string, provider: AuthProvider): void {
    this.providers.set(name, provider);
  }

  /**
   * Get auth provider by name
   */
  static getProvider(name?: string): AuthProvider {
    const providerName = name || process.env.AUTH_PROVIDER || 'jwt';

    // Initialize default providers if not registered
    if (!this.providers.has(providerName)) {
      this.initializeDefaultProviders();
    }

    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Auth provider '${providerName}' not found`);
    }

    return provider;
  }

  /**
   * Initialize default auth providers
   */
  private static initializeDefaultProviders(): void {
    // JWT Provider (default)
    this.registerProvider('jwt', new JWTAuthProvider());

    // OAuth2 Provider
    if (process.env.OAUTH2_CLIENT_ID && process.env.OAUTH2_CLIENT_SECRET) {
      this.registerProvider(
        'oauth2',
        new OAuth2Provider(
          process.env.OAUTH2_CLIENT_ID,
          process.env.OAUTH2_CLIENT_SECRET,
          process.env.OAUTH2_REDIRECT_URI || 'http://localhost:3000/auth/callback'
        )
      );
    }

    // Auth0 Provider
    if (process.env.AUTH0_DOMAIN && process.env.AUTH0_CLIENT_ID) {
      this.registerProvider(
        'auth0',
        new Auth0Provider(process.env.AUTH0_DOMAIN, process.env.AUTH0_CLIENT_ID)
      );
    }

    // Firebase Provider
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY) {
      this.registerProvider('firebase', new FirebaseAuthProvider());
    }
  }

  /**
   * Get all available providers
   */
  static getAvailableProviders(): string[] {
    this.initializeDefaultProviders();
    return Array.from(this.providers.keys());
  }

  /**
   * Check if provider is available
   */
  static hasProvider(name: string): boolean {
    this.initializeDefaultProviders();
    return this.providers.has(name);
  }
}

// Usage in your auth middleware:
// const authProvider = AuthFactory.getProvider();
// const user = await authProvider.validateToken(token);
