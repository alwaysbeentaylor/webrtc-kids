# Server Implementation Guide: Child Call Hangup Policy

This document outlines the server-side changes needed to implement the child call hangup policy.

## Overview

The policy enforces:
- **Child → Parent**: Child can cancel before answer, but cannot hang up after parent answers
- **Child ↔ Sibling**: Child can always hang up
- **Parent**: Can always end calls

## Required Changes

### 1. Call State Tracking

Track call state per active call:

```typescript
interface CallState {
  callId: string;
  callerId: string;
  calleeId: string;
  callerRole: 'parent' | 'child';
  calleeRole: 'parent' | 'child';
  phase: 'dialing' | 'ringing' | 'active' | 'ended';
  createdAt: number;
  answeredAt?: number;
}

// Store active calls in memory or database
private activeCalls: Map<string, CallState> = new Map();
```

### 2. New Socket Events

Handle these new events:

#### `call:cancel` (Client → Server)
- **When**: Before call is answered (dialing/ringing phase)
- **Action**: End call, notify other party
- **Always allowed**: Yes (anyone can cancel before answer)

```typescript
socket.on('call:cancel', (data: { targetUserId: string }) => {
  const userId = socket.userId; // From auth token
  const call = findActiveCall(userId, data.targetUserId);
  
  if (call && (call.phase === 'dialing' || call.phase === 'ringing')) {
    // End the call
    endCall(call.callId);
    
    // Notify other party
    notifyUser(data.targetUserId, 'call:cancel', { fromUserId: userId });
  }
});
```

#### `call:hangup` (Client → Server)
- **When**: After call is answered (active phase)
- **Action**: End call, notify other party
- **Policy Check**: Reject if child trying to hang up active parent call

```typescript
socket.on('call:hangup', (data: { targetUserId: string }) => {
  const userId = socket.userId;
  const userRole = getUserRole(userId); // 'parent' | 'child'
  const call = findActiveCall(userId, data.targetUserId);
  
  if (!call) {
    socket.emit('error', { 
      message: 'No active call found',
      code: 'ERR_NO_ACTIVE_CALL'
    });
    return;
  }
  
  if (call.phase !== 'active') {
    // Call not active, use cancel instead
    socket.emit('error', {
      message: 'Call is not active. Use cancel instead.',
      code: 'ERR_CALL_NOT_ACTIVE'
    });
    return;
  }
  
  // Policy enforcement: Child cannot hang up active parent call
  const isChildToParentActive = 
    userRole === 'child' && 
    call.callerRole === 'child' && 
    call.calleeRole === 'parent' && 
    call.phase === 'active';
  
  if (isChildToParentActive) {
    // REJECT: Log and notify client
    logRejectedHangup({
      userId,
      userRole,
      callId: call.callId,
      reason: 'ERR_POLICY_CHILD_CANNOT_HANGUP_PARENT_ACTIVE',
      timestamp: Date.now()
    });
    
    socket.emit('error', {
      message: 'Je kunt deze call niet beëindigen. Vraag de ouder om te beëindigen.',
      code: 'ERR_POLICY_CHILD_CANNOT_HANGUP_PARENT_ACTIVE'
    });
    return;
  }
  
  // Allowed: End the call
  endCall(call.callId);
  
  // Notify other party
  notifyUser(data.targetUserId, 'call:hangup', { fromUserId: userId });
  
  // Log successful hangup
  logSuccessfulHangup({
    userId,
    userRole,
    callId: call.callId,
    timestamp: Date.now()
  });
});
```

#### `call:answered` (Client → Server)
- **When**: When call is answered (after answer SDP is sent)
- **Action**: Update call phase to 'active', notify other party

```typescript
socket.on('call:answered', (data: { fromUserId: string; targetUserId: string }) => {
  const userId = socket.userId;
  const call = findActiveCall(userId, data.targetUserId);
  
  if (call && call.phase !== 'active') {
    call.phase = 'active';
    call.answeredAt = Date.now();
    
    // Notify caller that call was answered
    notifyUser(data.fromUserId, 'call:answered', {
      fromUserId: userId,
      targetUserId: data.fromUserId
    });
  }
});
```

### 3. Call Lifecycle Management

#### When Call Starts (`call:offer`)

```typescript
socket.on('call:offer', (data: { targetUserId: string; offer: RTCSessionDescriptionInit }) => {
  const callerId = socket.userId;
  const callerRole = getUserRole(callerId);
  const calleeRole = getUserRole(data.targetUserId);
  
  const call: CallState = {
    callId: generateCallId(),
    callerId,
    calleeId: data.targetUserId,
    callerRole,
    calleeRole,
    phase: 'dialing',
    createdAt: Date.now()
  };
  
  activeCalls.set(call.callId, call);
  
  // Forward offer to callee
  notifyUser(data.targetUserId, 'call:offer', {
    fromUserId: callerId,
    offer: data.offer,
    targetUserId: data.targetUserId
  });
});
```

#### When Call is Answered (`call:answer`)

```typescript
socket.on('call:answer', (data: { targetUserId: string; answer: RTCSessionDescriptionInit }) => {
  const calleeId = socket.userId;
  const call = findActiveCall(data.targetUserId, calleeId);
  
  if (call) {
    call.phase = 'ringing'; // Will transition to 'active' when call:answered is received
    
    // Forward answer to caller
    notifyUser(data.targetUserId, 'call:answer', {
      fromUserId: calleeId,
      answer: data.answer,
      targetUserId: data.targetUserId
    });
  }
});
```

### 4. Helper Functions

```typescript
// Find active call between two users
function findActiveCall(userId1: string, userId2: string): CallState | null {
  for (const call of activeCalls.values()) {
    if (
      (call.callerId === userId1 && call.calleeId === userId2) ||
      (call.callerId === userId2 && call.calleeId === userId1)
    ) {
      return call;
    }
  }
  return null;
}

// End call and cleanup
function endCall(callId: string): void {
  const call = activeCalls.get(callId);
  if (call) {
    call.phase = 'ended';
    
    // Notify both parties
    notifyUser(call.callerId, 'call:end', { fromUserId: call.calleeId });
    notifyUser(call.calleeId, 'call:end', { fromUserId: call.callerId });
    
    // Cleanup after delay
    setTimeout(() => {
      activeCalls.delete(callId);
    }, 5000);
  }
}

// Get user role from token/database
function getUserRole(userId: string): 'parent' | 'child' {
  // Implementation depends on your auth system
  // Check token or database
  const token = socket.auth.token;
  if (token.startsWith('child-token-')) {
    return 'child';
  }
  return 'parent'; // Default or check database
}
```

### 5. Logging and Telemetry

```typescript
interface HangupLog {
  userId: string;
  userRole: 'parent' | 'child';
  callId: string;
  action: 'hangup' | 'cancel';
  phase: string;
  allowed: boolean;
  reason?: string;
  timestamp: number;
}

function logRejectedHangup(log: HangupLog): void {
  console.warn('🚫 Hangup rejected:', log);
  // Send to analytics/monitoring service
  // Example: analytics.track('call.hangup.rejected', log);
}

function logSuccessfulHangup(log: HangupLog): void {
  console.log('✅ Hangup successful:', log);
  // Send to analytics/monitoring service
  // Example: analytics.track('call.hangup.success', log);
}
```

### 6. Error Codes

Define these error codes:

```typescript
const ERROR_CODES = {
  ERR_POLICY_CHILD_CANNOT_HANGUP_PARENT_ACTIVE: 'ERR_POLICY_CHILD_CANNOT_HANGUP_PARENT_ACTIVE',
  ERR_NO_ACTIVE_CALL: 'ERR_NO_ACTIVE_CALL',
  ERR_CALL_NOT_ACTIVE: 'ERR_CALL_NOT_ACTIVE'
};
```

### 7. Backward Compatibility

Keep `call:end` handler for backward compatibility:

```typescript
socket.on('call:end', (data: { targetUserId: string }) => {
  const userId = socket.userId;
  const call = findActiveCall(userId, data.targetUserId);
  
  if (call) {
    // Determine if it's cancel or hangup based on phase
    if (call.phase === 'dialing' || call.phase === 'ringing') {
      // Treat as cancel
      socket.emit('call:cancel', { targetUserId: data.targetUserId });
    } else {
      // Treat as hangup
      socket.emit('call:hangup', { targetUserId: data.targetUserId });
    }
  }
});
```

## Testing Checklist

- [ ] Child can cancel call to parent before answer
- [ ] Child cannot hang up active call with parent (rejected with error)
- [ ] Child can hang up active call with sibling
- [ ] Parent can always end calls
- [ ] `call:answered` signal transitions call to active phase
- [ ] Rejected hangups are logged
- [ ] Successful hangups are logged
- [ ] Error messages are user-friendly

## Migration Notes

1. **Gradual Rollout**: Consider feature flag `enforceParentActiveNoHangup`
2. **Monitoring**: Track rejection rate and user feedback
3. **Fallback**: If server enforcement fails, client-side guard still applies

## Example Server Implementation (Node.js/Socket.IO)

```typescript
import { Server } from 'socket.io';

const io = new Server(server, {
  cors: { origin: '*' }
});

interface CallState {
  callId: string;
  callerId: string;
  calleeId: string;
  callerRole: 'parent' | 'child';
  calleeRole: 'parent' | 'child';
  phase: 'dialing' | 'ringing' | 'active' | 'ended';
  createdAt: number;
  answeredAt?: number;
}

const activeCalls = new Map<string, CallState>();

io.use((socket, next) => {
  // Authenticate and attach userId/role to socket
  const token = socket.handshake.auth.token;
  socket.userId = extractUserId(token);
  socket.userRole = getUserRole(token);
  next();
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.userId);
  
  // Handle call:offer
  socket.on('call:offer', (data) => {
    const call: CallState = {
      callId: `call-${Date.now()}-${socket.userId}`,
      callerId: socket.userId,
      calleeId: data.targetUserId,
      callerRole: socket.userRole,
      calleeRole: getUserRole(data.targetUserId),
      phase: 'dialing',
      createdAt: Date.now()
    };
    
    activeCalls.set(call.callId, call);
    
    socket.to(`user:${data.targetUserId}`).emit('call:offer', {
      fromUserId: socket.userId,
      offer: data.offer,
      targetUserId: data.targetUserId
    });
  });
  
  // Handle call:answer
  socket.on('call:answer', (data) => {
    const call = findActiveCall(socket.userId, data.targetUserId);
    if (call) {
      call.phase = 'ringing';
      socket.to(`user:${data.targetUserId}`).emit('call:answer', {
        fromUserId: socket.userId,
        answer: data.answer,
        targetUserId: data.targetUserId
      });
    }
  });
  
  // Handle call:answered
  socket.on('call:answered', (data) => {
    const call = findActiveCall(socket.userId, data.targetUserId);
    if (call && call.phase !== 'active') {
      call.phase = 'active';
      call.answeredAt = Date.now();
      socket.to(`user:${data.targetUserId}`).emit('call:answered', {
        fromUserId: socket.userId,
        targetUserId: data.targetUserId
      });
    }
  });
  
  // Handle call:cancel
  socket.on('call:cancel', (data) => {
    const call = findActiveCall(socket.userId, data.targetUserId);
    if (call && (call.phase === 'dialing' || call.phase === 'ringing')) {
      endCall(call.callId);
      socket.to(`user:${data.targetUserId}`).emit('call:cancel', {
        fromUserId: socket.userId
      });
    }
  });
  
  // Handle call:hangup (with policy enforcement)
  socket.on('call:hangup', (data) => {
    const call = findActiveCall(socket.userId, data.targetUserId);
    
    if (!call) {
      socket.emit('error', {
        message: 'No active call found',
        code: 'ERR_NO_ACTIVE_CALL'
      });
      return;
    }
    
    if (call.phase !== 'active') {
      socket.emit('error', {
        message: 'Call is not active',
        code: 'ERR_CALL_NOT_ACTIVE'
      });
      return;
    }
    
    // Policy: Child cannot hang up active parent call
    const isChildCaller = call.callerRole === 'child';
    const isParentCallee = call.calleeRole === 'parent';
    const isChildHangingUp = socket.userId === call.callerId && isChildCaller;
    
    if (isChildHangingUp && isParentCallee && call.phase === 'active') {
      // REJECT
      logRejectedHangup({
        userId: socket.userId,
        userRole: socket.userRole,
        callId: call.callId,
        action: 'hangup',
        phase: call.phase,
        allowed: false,
        reason: 'ERR_POLICY_CHILD_CANNOT_HANGUP_PARENT_ACTIVE',
        timestamp: Date.now()
      });
      
      socket.emit('error', {
        message: 'Je kunt deze call niet beëindigen. Vraag de ouder om te beëindigen.',
        code: 'ERR_POLICY_CHILD_CANNOT_HANGUP_PARENT_ACTIVE'
      });
      return;
    }
    
    // ALLOWED
    endCall(call.callId);
    socket.to(`user:${data.targetUserId}`).emit('call:hangup', {
      fromUserId: socket.userId
    });
    
    logSuccessfulHangup({
      userId: socket.userId,
      userRole: socket.userRole,
      callId: call.callId,
      action: 'hangup',
      phase: call.phase,
      allowed: true,
      timestamp: Date.now()
    });
  });
  
  // Cleanup on disconnect
  socket.on('disconnect', () => {
    // Find and end all calls for this user
    for (const [callId, call] of activeCalls.entries()) {
      if (call.callerId === socket.userId || call.calleeId === socket.userId) {
        endCall(callId);
      }
    }
  });
});

function findActiveCall(userId1: string, userId2: string): CallState | null {
  for (const call of activeCalls.values()) {
    if (
      ((call.callerId === userId1 && call.calleeId === userId2) ||
       (call.callerId === userId2 && call.calleeId === userId1)) &&
      call.phase !== 'ended'
    ) {
      return call;
    }
  }
  return null;
}

function endCall(callId: string): void {
  const call = activeCalls.get(callId);
  if (call) {
    call.phase = 'ended';
    io.to(`user:${call.callerId}`).emit('call:end', { fromUserId: call.calleeId });
    io.to(`user:${call.calleeId}`).emit('call:end', { fromUserId: call.callerId });
    setTimeout(() => activeCalls.delete(callId), 5000);
  }
}

function getUserRole(token: string): 'parent' | 'child' {
  // Implement based on your auth system
  if (token.startsWith('child-token-')) {
    return 'child';
  }
  return 'parent';
}

function logRejectedHangup(log: any): void {
  console.warn('🚫 Hangup rejected:', log);
  // Add to your logging/monitoring system
}

function logSuccessfulHangup(log: any): void {
  console.log('✅ Hangup successful:', log);
  // Add to your logging/monitoring system
}
```

## Summary

The server must:
1. ✅ Track call state (dialing → ringing → active → ended)
2. ✅ Track user roles (parent/child) per call
3. ✅ Handle `call:cancel` (always allowed pre-answer)
4. ✅ Handle `call:hangup` (enforce policy: reject child→parent active)
5. ✅ Handle `call:answered` (transition to active)
6. ✅ Emit error with code `ERR_POLICY_CHILD_CANNOT_HANGUP_PARENT_ACTIVE` when policy violated
7. ✅ Log rejected and successful hangups for monitoring

The client is already implemented and ready to work with these server changes.


