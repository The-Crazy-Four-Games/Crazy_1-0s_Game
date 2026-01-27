export class RecordNotFound extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecordNotFound";
  }
}

export class UniqueConstraintViolation extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UniqueConstraintViolation";
  }
}

export class DatabaseConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseConnectionError";
  }
}

export class InvalidCredentials extends Error {
  constructor(message = "Invalid credentials") {
    super(message);
    this.name = "InvalidCredentials";
  }
}

export class UsernameTaken extends Error {
  constructor(message = "Username is already taken") {
    super(message);
    this.name = "UsernameTaken";
  }
}

export class WeakPassword extends Error {
  constructor(message = "Weak password") {
    super(message);
    this.name = "WeakPassword";
  }
}

export class InvalidToken extends Error {
  constructor(message = "Invalid token") {
    super(message);
    this.name = "InvalidToken";
  }
}

export class ExpiredToken extends Error {
  constructor(message = "Expired token") {
    super(message);
    this.name = "ExpiredToken";
  }
}

export class TokenSigningError extends Error {
  constructor(message = "Token signing/verifying error") {
    super(message);
    this.name = "TokenSigningError";
  }
}

export class CredentialStoreError extends Error {
  constructor(message = "Credential store error") {
    super(message);
    this.name = "CredentialStoreError";
  }
}

export class LogStoreError extends Error {
  constructor(message = "Log store error") {
    super(message);
    this.name = "LogStoreError";
  }
}
