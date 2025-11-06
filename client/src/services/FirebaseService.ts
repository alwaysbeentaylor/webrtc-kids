import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  onAuthStateChanged,
  type User,
  type AuthError
} from 'firebase/auth';
import { auth } from '../config/firebase';

export type AuthState = {
  user: User | null;
  loading: boolean;
  error: string | null;
};

class FirebaseService {
  private static instance: FirebaseService | null = null;
  private authStateListeners: Set<(state: AuthState) => void> = new Set();
  private currentUser: User | null = null;
  private isLoading = true;

  private constructor() {
    // Listen to auth state changes
    onAuthStateChanged(auth, (user) => {
      this.currentUser = user;
      this.isLoading = false;
      this.notifyListeners();
    });
  }

  static getInstance(): FirebaseService {
    if (!FirebaseService.instance) {
      FirebaseService.instance = new FirebaseService();
    }
    return FirebaseService.instance;
  }

  // Register new parent account
  async registerParent(email: string, password: string): Promise<void> {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      // Send email verification immediately
      await sendEmailVerification(userCredential.user);
      return;
    } catch (error) {
      const authError = error as AuthError;
      throw new Error(this.getErrorMessage(authError.code));
    }
  }

  // Login parent
  async loginParent(email: string, password: string): Promise<void> {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return;
    } catch (error) {
      const authError = error as AuthError;
      throw new Error(this.getErrorMessage(authError.code));
    }
  }

  // Logout
  async logout(): Promise<void> {
    try {
      await signOut(auth);
    } catch (error) {
      throw new Error('Logout mislukt');
    }
  }

  // Get current user
  getCurrentUser(): User | null {
    return this.currentUser;
  }

  // Get current user email
  getCurrentEmail(): string | null {
    return this.currentUser?.email ?? null;
  }

  // Check if email is verified (required for parent access)
  isEmailVerified(): boolean {
    return this.currentUser?.emailVerified ?? false;
  }

  // Resend verification email
  async resendVerificationEmail(): Promise<void> {
    if (!this.currentUser) {
      throw new Error('Geen gebruiker ingelogd');
    }
    try {
      await sendEmailVerification(this.currentUser);
    } catch (error) {
      throw new Error('Verificatie email kon niet verzonden worden');
    }
  }

  // Request password reset email
  async requestPasswordReset(email?: string): Promise<void> {
    const targetEmail = email || this.currentUser?.email;
    if (!targetEmail) throw new Error('Geen e-mailadres beschikbaar');
    try {
      await sendPasswordResetEmail(auth, targetEmail);
    } catch (error) {
      const authError = error as AuthError;
      // Map common errors to Dutch
      const map: Record<string,string> = {
        'auth/invalid-email': 'Ongeldig e-mailadres',
        'auth/user-not-found': 'Geen account gevonden met dit e-mailadres',
      };
      throw new Error(map[authError.code] || 'Kon reset e-mail niet verzenden');
    }
  }

  // Get ID token for authenticated requests
  async getIdToken(): Promise<string | null> {
    if (!this.currentUser) return null;
    try {
      return await this.currentUser.getIdToken();
    } catch (error) {
      return null;
    }
  }

  // Subscribe to auth state changes
  subscribe(callback: (state: AuthState) => void): () => void {
    this.authStateListeners.add(callback);
    // Immediately call with current state
    callback(this.getAuthState());
    // Return unsubscribe function
    return () => {
      this.authStateListeners.delete(callback);
    };
  }

  private notifyListeners(): void {
    const state = this.getAuthState();
    this.authStateListeners.forEach((callback) => callback(state));
  }

  private getAuthState(): AuthState {
    return {
      user: this.currentUser,
      loading: this.isLoading,
      error: null
    };
  }

  private getErrorMessage(code: string): string {
    const errorMessages: Record<string, string> = {
      'auth/email-already-in-use': 'Dit email adres is al geregistreerd',
      'auth/invalid-email': 'Ongeldig email adres',
      'auth/operation-not-allowed': 'Deze operatie is niet toegestaan',
      'auth/weak-password': 'Wachtwoord is te zwak (minimaal 6 karakters)',
      'auth/user-disabled': 'Dit account is uitgeschakeld',
      'auth/user-not-found': 'Geen account gevonden met dit email adres',
      'auth/wrong-password': 'Verkeerd wachtwoord',
      'auth/invalid-credential': 'Verkeerde inloggegevens'
    };
    return errorMessages[code] || 'Er is een fout opgetreden';
  }
}

export const firebaseService = FirebaseService.getInstance();

