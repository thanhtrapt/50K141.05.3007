export class AppError extends Error {
  constructor(status, code, message, fieldErrors = []) {
    super(message);
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export const badRequest = (message, fieldErrors = []) => new AppError(400,'VALIDATION_ERROR',message,fieldErrors);
export const unauthorized = (message = 'Yêu cầu đăng nhập để tiếp tục.') => new AppError(401,'UNAUTHORIZED',message);
export const forbidden = () => new AppError(403,'FORBIDDEN','Bạn không có quyền thực hiện thao tác này.');
export const notFound = (message) => new AppError(404,'NOT_FOUND',message);

export function fieldValidation(errors, message = 'Thông tin chưa hợp lệ, yêu cầu nhập lại') {
  if (errors.length) throw badRequest(message, errors);
}
