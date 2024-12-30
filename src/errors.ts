export class CriticalGameError extends Error {
    constructor(cause: Error) {
        super('A critical error has occured and the game has been terminated', { cause });
    }
}