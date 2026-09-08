/**
 * What to tell a shop owner when Razorpay says a payment failed.
 *
 * Razorpay's `error_code` is one of a handful of coarse buckets
 * ("BAD_REQUEST_ERROR" covers most declines) and `error_description`
 * ranges from readable ("Your payment didn't go through as it was
 * declined by the bank") to opaque. The code is kept on the row for
 * support; the owner sees this.
 *
 * Pure, so the screen and the email templates share it.
 */
export function describePaymentFailure(
  code?: string | null,
  reason?: string | null,
): string {
  const r = (reason ?? "").toLowerCase();

  if (/insufficient|balance|limit exceeded/.test(r)) {
    return "The bank said there wasn't enough balance or the card limit was reached.";
  }
  if (/declined|refused|do not honou?r|blocked by the bank|not permitted|disabled/.test(r)) {
    return "The bank declined the payment. Try another card, UPI or netbanking.";
  }
  if (/incorrect|invalid|wrong|expired card|cvv|otp|authentication/.test(r)) {
    return "The card details or OTP weren't accepted. Check them and try again.";
  }
  if (/timed? ?out|timeout|expired|took too long/.test(r)) {
    return "The bank took too long to respond and the attempt timed out. Try again.";
  }
  if (/cancel|abandon|closed|user/.test(r)) {
    return "The payment was cancelled before it finished.";
  }
  if (/upi|vpa|collect request|not approved/.test(r)) {
    return "The UPI request wasn't approved in time. Open your UPI app and try again.";
  }
  if (/network|connection|unavailable|downtime|technical/.test(r)) {
    return "There was a technical problem at the bank or Razorpay. Try again in a few minutes.";
  }

  switch (code) {
    case "GATEWAY_ERROR":
      return "The bank or card network couldn't process it. Try again in a few minutes.";
    case "SERVER_ERROR":
      return "Razorpay had a problem processing it. Try again in a few minutes.";
    default:
      return "The payment didn't go through. Try again, or use a different card or UPI.";
  }
}
