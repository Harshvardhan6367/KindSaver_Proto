import { randomBytes, randomUUID } from "node:crypto";
import { signToken } from "../auth/tokens.js";
import { hashPassword, verifyPassword } from "../auth/passwords.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function createAuthService(store, config) {
  return {
    async login(payload) {
      const email = String(payload.email || "").trim().toLowerCase();
      const password = String(payload.password || "");
      if (!email || !password) {
        const error = new Error("Email and password are required.");
        error.status = 400;
        throw error;
      }

      const user = await store.getUserByEmail(email);
      if (!user || !await verifyPassword(password, user)) {
        const error = new Error("Invalid email or password.");
        error.status = 401;
        throw error;
      }

      return {
        user: toPublicUser(user),
        token: signToken(user, config.jwtSecret)
      };
    },

    async register(payload) {
      const email = String(payload.email || "").trim().toLowerCase();
      const password = String(payload.password || "");
      const name = String(payload.name || "").trim();
      const phone = payload.phone ? String(payload.phone).trim() : null;
      const wardNumber = Number(payload.wardNumber) || null;

      // SECURITY: Public registration ALWAYS creates a 'citizen' role.
      // Roles 'admin' or 'ward_officer' can NEVER be registered through this public endpoint.
      const role = "citizen";

      if (!name || name.length < 2) {
        const error = new Error("Full name is required (at least 2 characters).");
        error.status = 400;
        throw error;
      }

      if (!email || !EMAIL_REGEX.test(email)) {
        const error = new Error("A valid email address is required.");
        error.status = 400;
        throw error;
      }

      if (!password || password.length < 6) {
        const error = new Error("Password must be at least 6 characters long.");
        error.status = 400;
        throw error;
      }

      const existing = await store.getUserByEmail(email);
      if (existing) {
        const error = new Error("An account with this email address already exists.");
        error.status = 409;
        throw error;
      }

      const { passwordSalt, passwordHash } = await hashPassword(password);
      const user = {
        id: `user-${randomUUID()}`,
        name,
        email,
        phone,
        wardNumber,
        role,
        officerId: null, // Public users can never assign themselves an officerId
        passwordSalt,
        passwordHash,
        createdAt: new Date().toISOString()
      };

      await store.createUser(user);

      return {
        user: toPublicUser(user),
        token: signToken(user, config.jwtSecret)
      };
    },

    async requestPasswordReset(payload) {
      const email = String(payload.email || "").trim().toLowerCase();
      if (!email || !EMAIL_REGEX.test(email)) {
        const error = new Error("A valid email address is required.");
        error.status = 400;
        throw error;
      }

      const user = await store.getUserByEmail(email);
      let resetToken = null;

      // Safe password reset: Do not reveal if email exists, but generate token if it does
      if (user) {
        resetToken = randomBytes(24).toString("hex");
        const tokenRecord = {
          token: resetToken,
          userId: user.id,
          email: user.email,
          expiresAt: Date.now() + 15 * 60 * 1000, // 15 minutes TTL
          used: false,
          createdAt: new Date().toISOString()
        };
        if (typeof store.savePasswordResetToken === "function") {
          await store.savePasswordResetToken(tokenRecord);
        }
      }

      return {
        ok: true,
        message: "If an account with that email exists, password reset instructions have been generated.",
        // Expose token in dev/test mode so automated tests can verify password reset flow safely
        resetToken: (process.env.NODE_ENV !== "production" && resetToken) ? resetToken : undefined
      };
    },

    async resetPassword(payload) {
      const token = String(payload.token || "").trim();
      const newPassword = String(payload.newPassword || "");

      if (!token) {
        const error = new Error("Reset token is required.");
        error.status = 400;
        throw error;
      }

      if (!newPassword || newPassword.length < 6) {
        const error = new Error("New password must be at least 6 characters long.");
        error.status = 400;
        throw error;
      }

      const tokenRecord = typeof store.getPasswordResetToken === "function"
        ? await store.getPasswordResetToken(token)
        : null;

      if (!tokenRecord || tokenRecord.used || tokenRecord.expiresAt < Date.now()) {
        const error = new Error("Invalid or expired password reset token.");
        error.status = 400;
        throw error;
      }

      const user = await store.getUserById(tokenRecord.userId);
      if (!user) {
        const error = new Error("Account not found.");
        error.status = 404;
        throw error;
      }

      const { passwordSalt, passwordHash } = await hashPassword(newPassword);
      await store.updateUser(user.id, {
        passwordSalt,
        passwordHash,
        devPassword: null,
        passwordChangedAt: new Date().toISOString()
      });

      if (typeof store.invalidatePasswordResetToken === "function") {
        await store.invalidatePasswordResetToken(token);
      }

      if (typeof store.revokeUser === "function") {
        await store.revokeUser(user.id, Date.now());
      }

      return {
        ok: true,
        message: "Password has been successfully updated. Please sign in with your new password."
      };
    },

    async updateProfile(userId, payload) {
      const user = await store.getUserById(userId);
      if (!user) {
        const error = new Error("User not found.");
        error.status = 404;
        throw error;
      }

      const patch = {};
      if (payload.name !== undefined) {
        const trimmedName = String(payload.name).trim();
        if (trimmedName.length < 2) {
          const error = new Error("Full name must be at least 2 characters long.");
          error.status = 400;
          throw error;
        }
        patch.name = trimmedName;
      }
      if (payload.phone !== undefined) {
        patch.phone = payload.phone ? String(payload.phone).trim() : null;
      }
      if (payload.wardNumber !== undefined && payload.wardNumber !== null && payload.wardNumber !== "") {
        const wardNum = Number(payload.wardNumber);
        if (!Number.isInteger(wardNum) || wardNum < 1 || wardNum > 250) {
          const error = new Error("Ward number must be an integer between 1 and 250.");
          error.status = 400;
          throw error;
        }
        patch.wardNumber = wardNum;
      } else if (payload.wardNumber === null || payload.wardNumber === "") {
        patch.wardNumber = null;
      }

      // SECURITY: User cannot update their own role or officerId
      const updated = await store.updateUser(userId, patch);
      return toPublicUser(updated);
    },

    async logout(token) {
      if (token && typeof store.revokeToken === "function") {
        await store.revokeToken(token);
      }
      return { ok: true, message: "Successfully logged out." };
    },

    toPublicUser
  };
}

export function toPublicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone || null,
    wardNumber: user.wardNumber || null,
    role: user.role || "citizen",
    officerId: user.officerId || null,
    createdAt: user.createdAt || null
  };
}
