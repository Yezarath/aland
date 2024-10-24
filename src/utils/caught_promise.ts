
export async function CaughtPromise(exec_cb: () => Promise<void>): Promise<void> {
	return await new Promise<void>(async (resolve, reject) => {
		try {
			await exec_cb();
			resolve();
		} catch (error) { reject(error); }
	}).catch(e => { throw new Error(e.message) });
}

export default CaughtPromise;
