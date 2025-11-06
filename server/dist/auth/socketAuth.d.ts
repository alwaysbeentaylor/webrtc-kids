import { Socket } from 'socket.io';
export interface AuthenticatedSocket extends Socket {
    userId?: string;
    userRole?: 'parent' | 'child';
    email?: string;
}
export declare function authenticateSocket(socket: AuthenticatedSocket): Promise<boolean>;
//# sourceMappingURL=socketAuth.d.ts.map