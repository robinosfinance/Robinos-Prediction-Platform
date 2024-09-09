const mapObject = (object, callback) =>
  Object.fromEntries(Object.entries(object).map(callback));

const filterObject = (object, callback) =>
  Object.fromEntries(Object.entries(object).filter(callback));

module.exports = {
  mapObject,
  filterObject,
};
