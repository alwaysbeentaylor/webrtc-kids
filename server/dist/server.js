"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const cors_1 = __importDefault(require("cors"));
const socket_io_1 = require("socket.io");
const socketAuth_1 = require("./auth/socketAuth");
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const PORT = Number(process.env.PORT || 4000);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
app.use((0, cors_1.default)({ origin: CLIENT_ORIGIN }));
app.use(express_1.default.json());
app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'signaling-server' });
});
const io = new socket_io_1.Server(server, {
    cors: {
        origin: CLIENT_ORIGIN,
        methods: ['GET', 'POST'],
        credentials: true
    }
});
// Authentication middleware for socket connections
io.use(async (socket, next) => {
    const authenticated = await (0, socketAuth_1.authenticateSocket)(socket);
    if (authenticated) {
        next();
    }
    else {
        next(new Error('Authentication failed'));
    }
});
io.on('connection', (socket) => {
    console.log('Authenticated socket connected:', socket.id, 'User:', socket.userId);
    // Ping/pong test
    socket.on('ping', (payload) => {
        console.log('ping from authenticated client:', socket.userId, payload);
        socket.emit('pong', { at: Date.now(), userId: socket.userId });
    });
    // WebRTC signaling events (will be expanded later)
    socket.on('call:offer', (data) => {
        console.log('Call offer from:', socket.userId, 'to:', data.targetUserId);
        // Forward offer to target user
        socket.to(`user:${data.targetUserId}`).emit('call:offer', {
            ...data,
            fromUserId: socket.userId
        });
    });
    socket.on('call:answer', (data) => {
        console.log('Call answer from:', socket.userId, 'to:', data.targetUserId);
        // Forward answer to caller
        socket.to(`user:${data.targetUserId}`).emit('call:answer', {
            ...data,
            fromUserId: socket.userId
        });
    });
    socket.on('call:ice-candidate', (data) => {
        console.log('ICE candidate from:', socket.userId, 'to:', data.targetUserId);
        // Forward ICE candidate
        socket.to(`user:${data.targetUserId}`).emit('call:ice-candidate', {
            ...data,
            fromUserId: socket.userId
        });
    });
    socket.on('call:end', (data) => {
        console.log('Call end from:', socket.userId, 'to:', data.targetUserId);
        // Only parents can end calls (will be enforced by userRole check later)
        if (socket.userRole === 'parent') {
            socket.to(`user:${data.targetUserId}`).emit('call:end', {
                fromUserId: socket.userId
            });
        }
        else {
            socket.emit('error', { message: 'Only parents can end calls' });
        }
    });
    // Join user room for targeted messaging
    socket.on('join:user-room', () => {
        if (socket.userId) {
            socket.join(`user:${socket.userId}`);
            console.log('User joined their room:', socket.userId);
        }
    });
    socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', socket.id, socket.userId, reason);
    });
});
server.listen(PORT, () => {
    console.log(`Signaling server listening on http://localhost:${PORT}`);
});
//# sourceMappingURL=server.js.map