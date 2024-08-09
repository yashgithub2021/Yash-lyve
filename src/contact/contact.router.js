const express = require("express");
const router = express.Router();
const {
  createContact,
  getContacts,
  getSingleContact,
  deleteContact,
} = require("./contact.controller");

router.post("/create-contact", createContact);
router.get("/get-contacts", getContacts);
router.get("/contact/:id", getSingleContact);
router.delete("/contact-delete/:id", deleteContact);

module.exports = router;
