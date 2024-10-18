
/**
 * Sleep for a given amount of time
 * @param ms - The number of milliseconds to sleep
 * @returns A promise that resolves after the given amount of time
 */
export function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}
