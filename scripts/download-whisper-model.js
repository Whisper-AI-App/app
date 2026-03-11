const https = require("https");
const fs = require("fs");
const path = require("path");

const MODEL_URL =
	"https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin";
const MODEL_DIR = path.join(__dirname, "..", "assets", "models");
const MODEL_PATH = path.join(MODEL_DIR, "ggml-base.bin");
// Expected size: ~141MB (ggml-base.bin from whisper.cpp)
const MIN_SIZE_BYTES = 140_000_000;

function download(url, dest) {
	return new Promise((resolve, reject) => {
		const follow = (url) => {
			https
				.get(url, (res) => {
					if (
						res.statusCode >= 300 &&
						res.statusCode < 400 &&
						res.headers.location
					) {
						follow(res.headers.location);
						return;
					}
					if (res.statusCode !== 200) {
						reject(new Error(`HTTP ${res.statusCode} for ${url}`));
						return;
					}
					const totalBytes = parseInt(res.headers["content-length"], 10);
					let downloadedBytes = 0;
					let lastPercent = -1;

					const file = fs.createWriteStream(dest);
					res.on("data", (chunk) => {
						downloadedBytes += chunk.length;
						if (totalBytes) {
							const percent = Math.floor(
								(downloadedBytes / totalBytes) * 100,
							);
							if (percent !== lastPercent) {
								lastPercent = percent;
								const dlMB = (downloadedBytes / 1e6).toFixed(1);
								const totalMB = (totalBytes / 1e6).toFixed(1);
								process.stdout.write(
									`\r[whisper-model] ${dlMB}MB / ${totalMB}MB (${percent}%)`,
								);
							}
						}
					});
					res.pipe(file);
					file.on("finish", () => {
						if (totalBytes) process.stdout.write("\n");
						file.close(resolve);
					});
					file.on("error", (err) => {
						fs.unlink(dest, () => {});
						reject(err);
					});
				})
				.on("error", reject);
		};
		follow(url);
	});
}

async function main() {
	// Skip if file already exists and is the right size
	if (fs.existsSync(MODEL_PATH)) {
		const stat = fs.statSync(MODEL_PATH);
		if (stat.size >= MIN_SIZE_BYTES) {
			console.log(
				"[whisper-model] ggml-base.bin already exists, skipping download.",
			);
			return;
		}
		console.log(
			"[whisper-model] ggml-base.bin exists but looks incomplete, re-downloading...",
		);
	}

	fs.mkdirSync(MODEL_DIR, { recursive: true });

	console.log("[whisper-model] Downloading ggml-base.bin (~141MB)...");
	await download(MODEL_URL, MODEL_PATH);

	const stat = fs.statSync(MODEL_PATH);
	if (stat.size < MIN_SIZE_BYTES) {
		fs.unlinkSync(MODEL_PATH);
		throw new Error(
			`Download too small (${stat.size} bytes). Expected >= ${MIN_SIZE_BYTES}.`,
		);
	}

	console.log(
		`[whisper-model] Downloaded ggml-base.bin (${(stat.size / 1e6).toFixed(1)}MB)`,
	);

	process.exit(0);
}

main().catch((err) => {
	console.error(
		"[whisper-model] Failed to download whisper model:",
		err.message,
	);
	process.exit(1);
});
