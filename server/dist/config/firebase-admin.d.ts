import * as admin from 'firebase-admin';
declare let firebaseAdmin: admin.app.App;
export default firebaseAdmin;
export declare function verifyIdToken(idToken: string): Promise<admin.auth.DecodedIdToken>;
//# sourceMappingURL=firebase-admin.d.ts.map