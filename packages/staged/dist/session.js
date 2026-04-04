"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadSession = loadSession;
exports.saveSession = saveSession;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const SESSION_DIR = path_1.default.join(os_1.default.homedir(), ".staged-agent", "sessions");
async function loadSession(sessionId) {
    try {
        const filePath = path_1.default.join(SESSION_DIR, `${sessionId}.json`);
        const raw = await promises_1.default.readFile(filePath, "utf-8");
        const parsed = JSON.parse(raw);
        return {
            sessionId,
            messages: Array.isArray(parsed.messages) ? parsed.messages : [],
        };
    }
    catch {
        return { sessionId, messages: [] };
    }
}
async function saveSession(session) {
    try {
        await promises_1.default.mkdir(SESSION_DIR, { recursive: true });
        const filePath = path_1.default.join(SESSION_DIR, `${session.sessionId}.json`);
        await promises_1.default.writeFile(filePath, JSON.stringify(session, null, 2), "utf-8");
    }
    catch {
        // non-fatal — session persistence is best-effort
    }
}
