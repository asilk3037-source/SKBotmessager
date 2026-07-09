// Express 4 does not forward rejections from `async` route handlers to the
// error middleware on its own — an unhandled rejection just leaves the
// request hanging until the client times out. Wrap any async handler with
// this so a thrown/rejected error reaches `next(err)` and gets a real
// response instead.
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
