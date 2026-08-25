// Shared by every public self-serve registration flow (free agent, team, ...)
// — lives here rather than inside one specific flow's file since it's not
// owned by any single one of them.
export class RegistrationError extends Error {
    constructor(code, message, status) {
        super(message);
        this.code = code;
        this.status = status;
    }
}
