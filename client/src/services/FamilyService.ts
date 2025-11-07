import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  updateDoc,
  deleteDoc,
  serverTimestamp,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../config/firebase';

export interface FamilyMember {
  id: string;
  email?: string;
  displayName: string;
  role: 'parent' | 'child';
  familyId: string;
  createdAt: any;
  photoURL?: string;
  isOnline?: boolean;
  gender?: 'boy' | 'girl' | null;
  parentGender?: 'mother' | 'father' | null;
}

export interface ChildCode {
  code: string;
  childName: string;
  familyId: string;
  createdAt: any;
  expiresAt: any;
  used: boolean;
  usedBy?: string;
  usedAt?: any;
  gender?: 'boy' | 'girl' | null;
  codeType: 'child' | 'parent'; // New: type of code
  parentGender?: 'mother' | 'father' | null; // when codeType is parent
}

class FamilyService {
  // Get or create family ID for current user
  async getOrCreateFamily(userId: string, userEmail: string, displayName: string): Promise<string> {
    try {
      // Check if user already has a family
      const userDoc = await getDoc(doc(db, 'users', userId));
      
      if (userDoc.exists() && userDoc.data().familyId) {
        return userDoc.data().familyId;
      }

      // Create new family
      const familyId = `family-${Date.now()}`;
      const familyRef = doc(db, 'families', familyId);
      await setDoc(familyRef, {
        name: `${displayName}'s Familie`,
        createdAt: serverTimestamp(),
        guardianIds: [userId]
      });

      // Add user to family
      await this.addFamilyMember(userId, familyId, {
        email: userEmail,
        displayName,
        role: 'parent'
      });

      return familyId;
    } catch (error) {
      console.error('Error in getOrCreateFamily:', error);
      // If Firestore fails, use a fallback family ID stored in localStorage
      const fallbackFamilyId = localStorage.getItem(`family_${userId}`);
      if (fallbackFamilyId) {
        return fallbackFamilyId;
      }
      
      // Create fallback family ID
      const fallbackId = `family-${Date.now()}`;
      localStorage.setItem(`family_${userId}`, fallbackId);
      throw error; // Re-throw so caller can handle
    }
  }

  // Check if family has reached max parents (2)
  async canAddParent(familyId: string): Promise<boolean> {
    try {
      const members = await this.getFamilyMembers(familyId);
      const parentCount = members.filter(m => m.role === 'parent').length;
      return parentCount < 2;
    } catch (error) {
      console.error('Error checking parent count:', error);
      return false;
    }
  }

  // Add family member
  async addFamilyMember(userId: string, familyId: string, memberData: Partial<FamilyMember>): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId);
      
      // Filter out undefined values to prevent Firestore errors
      const cleanData: any = {
        id: userId,
        familyId,
        createdAt: serverTimestamp()
      };
      
      // Only add defined values (allow null, but filter undefined)
      Object.keys(memberData).forEach(key => {
        const value = (memberData as any)[key];
        if (value !== undefined) {
          cleanData[key] = value;
        }
      });
      
      await setDoc(userRef, cleanData, { merge: true });
    } catch (error) {
      console.error('Error adding family member:', error);
      // Store in localStorage as fallback
      const fallbackData = {
        ...memberData,
        id: userId,
        familyId
      };
      localStorage.setItem(`user_${userId}`, JSON.stringify(fallbackData));
      throw error;
    }
  }

  // Generate code for child or parent
  async generateCode(
    familyId: string, 
    name: string, 
    parentUserId: string, 
    codeType: 'child' | 'parent',
    gender?: 'boy' | 'girl' | null,
    parentGender?: 'mother' | 'father' | null
  ): Promise<string> {
    // Validate input
    if (!name || name.trim().length < 2) {
      throw new Error('Naam moet minimaal 2 karakters zijn');
    }
    if (name.length > 50) {
      throw new Error('Naam mag maximaal 50 karakters zijn');
    }

    // Check if we can add a parent (max 2)
    if (codeType === 'parent') {
      const canAdd = await this.canAddParent(familyId);
      if (!canAdd) {
        throw new Error('Maximum aantal ouders (2) bereikt');
      }
    }
    
    // Generate random 6-digit code (ensure it's unique)
    let code: string;
    let attempts = 0;
    do {
      code = Math.floor(100000 + Math.random() * 900000).toString();
      attempts++;
      if (attempts > 10) {
        throw new Error('Kon geen unieke code genereren. Probeer opnieuw.');
      }
      // Check if code already exists
      const codeRef = doc(db, 'childCodes', code);
      const codeDoc = await getDoc(codeRef);
      if (!codeDoc.exists()) break;
    } while (true);
    
    const codeRef = doc(db, 'childCodes', code);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // Valid for 24 hours

    await setDoc(codeRef, {
      code,
      childName: name, // Keep same field name for compatibility
      familyId,
      parentUserId,
      createdAt: serverTimestamp(),
      expiresAt: expiresAt.toISOString(),
      used: false,
      gender: gender || null,
      codeType: codeType,
      parentGender: parentGender || null
    });

    return code;
  }

  // Generate child code (backward compatibility)
  async generateChildCode(familyId: string, childName: string, parentUserId: string, gender?: 'boy' | 'girl' | null): Promise<string> {
    return this.generateCode(familyId, childName, parentUserId, 'child', gender);
  }

  // Redeem code (child or parent)
  async redeemCode(code: string, userEmail?: string): Promise<{ name: string; familyId: string; userId: string; role: 'child' | 'parent' }> {
    // Validate code format
    if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
      throw new Error('Ongeldige code. Code moet 6 cijfers zijn.');
    }
    
    const codeRef = doc(db, 'childCodes', code);
    const codeDoc = await getDoc(codeRef);

    if (!codeDoc.exists()) {
      throw new Error('Code niet gevonden. Controleer de code en probeer opnieuw.');
    }

    const codeData = codeDoc.data() as ChildCode;

    if (codeData.used) {
      throw new Error('Code is al gebruikt');
    }

    const expiresAt = new Date(codeData.expiresAt);
    if (expiresAt < new Date()) {
      throw new Error('Code is verlopen');
    }

    const codeType = codeData.codeType || 'child'; // Default to 'child' for backward compatibility
    const familyId = codeData.familyId;

    // Check if we can add a parent (max 2)
    if (codeType === 'parent') {
      const canAdd = await this.canAddParent(familyId);
      if (!canAdd) {
        throw new Error('Maximum aantal ouders (2) bereikt');
      }
    }

    // Create user account
    const userId = codeType === 'parent' 
      ? `parent-${Date.now()}` 
      : `child-${Date.now()}`;

    // Mark code as used
    await updateDoc(codeRef, {
      used: true,
      usedBy: userId,
      usedAt: serverTimestamp()
    });

    // Add user to family
    const memberDataToSave: Partial<FamilyMember> = {
      displayName: codeData.childName,
      role: codeType,
      gender: codeType === 'child' ? (codeData.gender || null) : undefined,
      parentGender: codeType === 'parent' ? (codeData.parentGender || null) : undefined
    };
    
    // Only add email if it's provided (for parents)
    if (userEmail && userEmail.trim()) {
      memberDataToSave.email = userEmail.trim();
    }
    
    await this.addFamilyMember(userId, familyId, memberDataToSave);

    return {
      name: codeData.childName,
      familyId,
      userId,
      role: codeType
    };
  }

  // Redeem child code (backward compatibility)
  async redeemChildCode(code: string): Promise<{ childName: string; familyId: string; userId: string }> {
    const result = await this.redeemCode(code);
    return {
      childName: result.name,
      familyId: result.familyId,
      userId: result.userId
    };
  }

  // Get family members
  async getFamilyMembers(familyId: string): Promise<FamilyMember[]> {
    try {
      const q = query(collection(db, 'users'), where('familyId', '==', familyId));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as FamilyMember)).sort((a, b) => {
        // Parents first, then children
        if (a.role === 'parent' && b.role !== 'parent') return -1;
        if (a.role !== 'parent' && b.role === 'parent') return 1;
        return 0;
      });
    } catch (error) {
      console.error('Error getting family members:', error);
      // Fallback: return empty array or localStorage data
      return [];
    }
  }

  // Subscribe to family members with real-time updates (including online status)
  subscribeToFamilyMembers(familyId: string, callback: (members: FamilyMember[]) => void): () => void {
    try {
      const q = query(collection(db, 'users'), where('familyId', '==', familyId));
      
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const members = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as FamilyMember)).sort((a, b) => {
          // Parents first, then children
          if (a.role === 'parent' && b.role !== 'parent') return -1;
          if (a.role !== 'parent' && b.role === 'parent') return 1;
          return 0;
        });
        
        console.log('📡 Real-time family members update:', members.length, 'members');
        callback(members);
      }, (error) => {
        console.error('Error in family members subscription:', error);
        // Fallback: try to get members once
        this.getFamilyMembers(familyId).then(callback).catch(() => {
          callback([]);
        });
      });
      
      return unsubscribe;
    } catch (error) {
      console.error('Error setting up family members subscription:', error);
      // Fallback: try to get members once
      this.getFamilyMembers(familyId).then(callback).catch(() => {
        callback([]);
      });
      // Return empty unsubscribe function
      return () => {};
    }
  }

  // Get user info
  async getUserInfo(userId: string): Promise<FamilyMember | null> {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) return null;
    
    return {
      id: userDoc.id,
      ...userDoc.data()
    } as FamilyMember;
  }

  // Update user online status
  async updateOnlineStatus(userId: string, isOnline: boolean): Promise<void> {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      isOnline,
      lastSeen: serverTimestamp()
    });
  }

  // Update user display name
  async updateDisplayName(userId: string, newDisplayName: string): Promise<void> {
    if (!newDisplayName || newDisplayName.trim().length < 2) {
      throw new Error('Naam moet minimaal 2 karakters zijn');
    }
    if (newDisplayName.length > 50) {
      throw new Error('Naam mag maximaal 50 karakters zijn');
    }
    
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      displayName: newDisplayName.trim()
    });
  }

  // Delete child account (only parents can delete children)
  async deleteChild(childUserId: string, parentUserId: string): Promise<void> {
    try {
      // Verify the child exists and belongs to the same family as parent
      const childDoc = await getDoc(doc(db, 'users', childUserId));
      if (!childDoc.exists()) {
        throw new Error('Kind niet gevonden');
      }

      const childData = childDoc.data();
      if (childData.role !== 'child') {
        throw new Error('Alleen kinderen kunnen worden verwijderd');
      }

      // Verify parent exists and is in same family
      const parentDoc = await getDoc(doc(db, 'users', parentUserId));
      if (!parentDoc.exists()) {
        throw new Error('Ouder niet gevonden');
      }

      const parentData = parentDoc.data();
      if (parentData.role !== 'parent') {
        throw new Error('Alleen ouders kunnen kinderen verwijderen');
      }

      if (childData.familyId !== parentData.familyId) {
        throw new Error('Kind behoort niet tot jouw familie');
      }

      // Delete child user document
      await deleteDoc(doc(db, 'users', childUserId));

      // Also clean up localStorage if exists
      localStorage.removeItem(`user_${childUserId}`);
      localStorage.removeItem(`family_${childUserId}`);
      
      console.log(`✅ Child ${childUserId} deleted successfully`);
    } catch (error) {
      console.error('Error deleting child:', error);
      throw error;
    }
  }

  // Subscribe to child deletion (for child accounts to detect when they're deleted)
  subscribeToChildDeletion(childUserId: string, onDeleted: () => void): () => void {
    const userRef = doc(db, 'users', childUserId);
    let hasSeenDocument = false; // Track if we've ever seen the document exist
    
    const unsubscribe = onSnapshot(userRef, (snapshot) => {
      if (snapshot.exists()) {
        hasSeenDocument = true; // Document exists, mark as seen
      } else if (hasSeenDocument) {
        // Document was deleted (we saw it before, now it's gone)
        console.log('⚠️ Child account deleted, logging out...');
        onDeleted();
      }
      // If document never existed, don't trigger deletion (might be initial load)
    }, (error: any) => {
      console.error('Error listening to child deletion:', error);
      // Only treat as deleted if we've seen the document exist before
      // This prevents false positives from temporary network issues
      if (hasSeenDocument && (error?.code === 'permission-denied' || error?.code === 'not-found')) {
        console.log('⚠️ Child account appears to be deleted (permission denied or not found)');
        onDeleted();
      }
    });

    return unsubscribe;
  }
}

export const familyService = new FamilyService();

