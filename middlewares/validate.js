const ErrorHandler = require("../utils/errorHandler");
const { StatusCodes } = require("http-status-codes");
class Validate {
  constructor() {
    this.userAttr = {
      create: [
        "username",
        "email",
        "password",
        "mobile_no",
        "country",
        "dob",
        "gender"
      ],
      login: ["email", "password"],
      updatePassword: ["password", "confirmPassword"],
    };

    this.warehouseAttr = {
      assign: [
        "warehouses",
        "controllerId",
        "warehouse",
        "managerId",
        "controllers",
        "warehouseId",
      ],
    };

    this.orderAttr = {
      create: ["address", "items", "warehouse", "user", "orderType"],
      update: [
        "tin_no",
        "address",
        "transit_company",
        "consignee",
        "custom_agent",
        "DDCOM_no",
        "quantity_decl",
        "physical_quant",
        "arrival_date",
        "last_storage_date",
        "truck_no",
        "truck_no_to",
        "container_no",
        "transporter",
        "ref_no",
        "desc_product",
        "unit",
        "comment",
        "name_counter",
        "counter_valid",
        "customs",
        "client_valid",
      ],
    };

    this.missingFields = (fields, req) => {
      const reqFields = new Set(Object.keys(req.body));
      const misFields = fields.filter((k) => !reqFields.has(k));
      return misFields.length > 0 && `Required Fields ${misFields.join(", ")}.`;
    };

    this.warehouseAssign = (req) => {
      const reqFields = new Set(Object.keys(req.body));
      if (reqFields.size === 0)
        return `Required Fields ${this.warehouseAttr.assign.join(", ")}`;

      if (reqFields.has("controllerId") && !reqFields.has("warehouses"))
        return "Required Field warehouses";

      if (!reqFields.has("controllerId") && reqFields.has("warehouses"))
        return "Required Field controllerId";

      if (reqFields.has("controllers") && !reqFields.has("warehouseId"))
        return "Required Field warehouseId";

      if (!reqFields.has("controllers") && reqFields.has("warehouseId"))
        return "Required Field controllers";

      if (reqFields.has("managerId") && !reqFields.has("warehouse"))
        return "Required Field warehouse";

      if (!reqFields.has("managerId") && reqFields.has("warehouse"))
        return "Required Field managerId";
    };

    this.passwordUpdate = (fields, req) => {
      const reqFields = new Set(Object.keys(req.body));
      const misFields = fields.filter((k) => !reqFields.has(k));

      if (misFields.length > 0) {
        return `Required Fields ${misFields.join(", ")}.`;
      }

      const { password, confirmPassword } = req.body;

      if (password !== confirmPassword)
        return `Password and ConfirmPassword must be same`;
    };
  }

  user = {
    post: async (req, res, next) => {
      console.log("Inside user validate");
      const misFields = this.missingFields(this.userAttr.create, req);
      if (misFields)
        return next(new ErrorHandler(misFields, StatusCodes.BAD_REQUEST));
      next();
    },
    login: async (req, res, next) => {
      console.log("Inside user login");
      const misFields = this.missingFields(this.userAttr.login, req);
      if (misFields)
        return next(new ErrorHandler(misFields, StatusCodes.BAD_REQUEST));
      next();
    },
    updatePassword: (req, res, next) => {
      console.log("Inside user update password");
      const isAnyError = this.passwordUpdate(this.userAttr.updatePassword, req);
      if (isAnyError)
        return next(new ErrorHandler(isAnyError, StatusCodes.BAD_REQUEST));

      next();
    },
  };

  warehouse = {
    assign: async (req, res, next) => {
      const misFields = this.warehouseAssign(req);
      if (misFields)
        return next(new ErrorHandler(misFields, StatusCodes.BAD_REQUEST));
      next();
    },
    remove: async (req, res, next) => {
      const misFields = this.warehouseRemove(req);
      if (misFields)
        return next(new ErrorHandler(misFields, StatusCodes.BAD_REQUEST));
      next();
    },
  };

  order = {
    post: async (req, res, next) => {
      const misFields = this.missingFields(this.orderAttr.create, req);
      if (misFields)
        return next(new ErrorHandler(misFields, StatusCodes.BAD_REQUEST));
      next();
    },
    put: async (req, res, next) => {
      req.body = Object.fromEntries(
        Object.entries(req.body).filter(([key, value]) =>
          this.orderAttr.update.includes(key)
        )
      );

      console.log({ bodt: req.body });
      if (!req.body || Object.keys(req.body).length === 0) {
        return next(
          new ErrorHandler(
            `Please provide at least one of the fields - ${this.orderAttr.update.join(
              ", "
            )}.`,
            StatusCodes.BAD_REQUEST
          )
        );
      }

      next();
    },
    updateStatus: async (req, res, next) => {
      if (!req.body.status) {
        return next(
          new ErrorHandler("Please provide the status", StatusCodes.BAD_REQUEST)
        );
      }

      req.body = Object.fromEntries(
        Object.entries(req.body).filter(([key, value]) => key === "status")
      );
      next();
    },
    item: async (req, res, next) => {
      const { items } = req.body;
      if (!items) {
        return next(
          new ErrorHandler("Please provide items.", StatusCodes.BAD_REQUEST)
        );
      }

      if (!items.length || items.length === 0) {
        return next(
          new ErrorHandler(
            "Please add atleast one item.",
            StatusCodes.BAD_REQUEST
          )
        );
      }

      next();
    },
    itemObj: async (req, res, next) => {
      const { quantity, name } = req.body;
      if (!quantity && !name) {
        return next(
          new ErrorHandler(
            "Missing fields - quantity and name",
            StatusCodes.BAD_REQUEST
          )
        );
      }
      next();
    },
  };
}

module.exports = new Validate();
