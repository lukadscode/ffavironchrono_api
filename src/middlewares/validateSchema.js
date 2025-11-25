module.exports = (schema, source = "body") => {
  return (req, res, next) => {
    const dataToValidate = source === "query" ? req.query : req.body;
    const { error } = schema.validate(dataToValidate);
    if (error) {
      return res
        .status(400)
        .json({ status: "error", message: error.details[0].message });
    }
    next();
  };
};
