/**
 * Formats a date for display in chat previews:
 * - Today: Shows time (e.g., "10:30 AM")
 * - This year (not today): Shows date (e.g., "11th Jan")
 * - Previous years: Shows month and year (e.g., "Jan, 24")
 */
export function formatChatPreviewDate(date: Date): string {
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

	// Check if date is today
	if (dateDay.getTime() === today.getTime()) {
		return date.toLocaleString(undefined, {
			timeStyle: "short",
		});
	}

	// Check if date is same year
	if (date.getFullYear() === now.getFullYear()) {
		const day = date.getDate();
		const suffix = getDaySuffix(day);
		const month = date.toLocaleString(undefined, { month: "short" });
		return `${day}${suffix} ${month}`;
	}

	// Different year
	const month = date.toLocaleString(undefined, { month: "short" });
	const year = date.getFullYear().toString().slice(-2); // Last 2 digits
	return `${month}, ${year}`;
}

/**
 * Returns the ordinal suffix for a day number (st, nd, rd, th)
 */
function getDaySuffix(day: number): string {
	if (day >= 11 && day <= 13) {
		return "th";
	}
	switch (day % 10) {
		case 1:
			return "st";
		case 2:
			return "nd";
		case 3:
			return "rd";
		default:
			return "th";
	}
}
