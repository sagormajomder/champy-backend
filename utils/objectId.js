import { ObjectId } from 'mongodb';

export function toObjectId(id) {
  if (!ObjectId.isValid(id)) {
    const error = new Error(`Invalid ObjectId: ${id}`);
    error.status = 400;
    throw error;
  }

  return new ObjectId(id);
}
