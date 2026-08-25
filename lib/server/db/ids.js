import { ObjectId } from 'mongodb';

export function toObjectId(id) {
  if (!ObjectId.isValid(id)) return null;
  return new ObjectId(id);
}

export function serialize(doc) {
  if (!doc) return doc;
  return {
    ...doc,
    id: doc._id?.toString?.() ?? doc.id,
    _id: undefined,
  };
}
