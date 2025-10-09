// Ensure BigInt can be serialized by JSON.stringify in Jest worker messaging
if (typeof BigInt.prototype.toJSON !== 'function') {
  Object.defineProperty(BigInt.prototype, 'toJSON', {
    value: function () {
      return this.toString();
    },
    configurable: true,
  });
}

const originalStringify = JSON.stringify;
JSON.stringify = function (value, replacer, space) {
  const bigIntReplacer = (key, val) => {
    const replaced = typeof val === 'bigint' ? val.toString() : val;
    return typeof replacer === 'function' ? replacer(key, replaced) : replaced;
  };
  return originalStringify(value, bigIntReplacer, space);
};
