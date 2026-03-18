let nextId = 1;

const mockContext = {
	id: 1,
	gpu: false,
	reasonNoGPU: "",
	transcribe: jest.fn().mockReturnValue({
		stop: jest.fn(),
		promise: Promise.resolve({
			result: " Hello world ",
			isAborted: false,
		}),
	}),
	release: jest.fn().mockResolvedValue(undefined),
};

export const initWhisper = jest.fn().mockImplementation(async () => {
	mockContext.id = nextId++;
	return mockContext;
});

export const releaseAllWhisper = jest.fn().mockResolvedValue(undefined);

export type WhisperContext = typeof mockContext;
