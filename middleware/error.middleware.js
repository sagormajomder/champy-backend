// 404 Route Not Found Handler
export function notFoundHandler(req, res, next) {
  res.status(404).send({ message: 'Route not found' });
}

// Global Error Handler
export function errorHandler(err, req, res, next) {
  console.error('Server Internal Error:', err);
  const status = err.status || err.statusCode || 500;
  const message = status === 500 ? 'Internal Server Error' : err.message;
  res.status(status).send({ message });
}
