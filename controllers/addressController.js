const Address = require("../models/address.model");
const mongoose = require("mongoose");

exports.createAddress = async (req, res) => {
  try {
    const userId = req.userId;
    const { address, city, postalCode, country, phone, isDefault } = req.body;

    if (!address || !city || !postalCode || !country || !phone) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const hasAddresses = await Address.exists({ user: userId });
    const shouldBeDefault = isDefault === true || !hasAddresses;

    if (shouldBeDefault) {
      await Address.updateMany(
        { user: userId },
        { $set: { isDefault: false } },
      );
    }

    const newAddress = new Address({
      user: userId,
      address,
      city,
      postalCode,
      country,
      phone,
      isDefault: shouldBeDefault,
    });

    const savedAddress = await newAddress.save();
    res.status(201).json({
      message: "Address created successfully",
      data: savedAddress,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getUserAddresses = async (req, res) => {
  try {
    const userId = req.userId;
    const addresses = await Address.find({ user: userId }).sort({
      isDefault: -1,
      createdAt: -1,
    });
    res
      .status(200)
      .json({ message: "Addresses retrieved successfully", data: addresses });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getAddressById = async (req, res) => {
  try {
    const userId = req.userId;
    const addressId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(addressId)) {
      return res.status(400).json({ message: "Invalid address ID" });
    }

    const address = await Address.findOne({ _id: addressId, user: userId });
    if (!address) {
      return res.status(404).json({ message: "Address not found" });
    }

    res
      .status(200)
      .json({ message: "Address retrieved successfully", data: address });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.updateAddress = async (req, res) => {
  try {
    const userId = req.userId;
    const addressId = req.params.id;
    const { address, city, postalCode, country, phone, isDefault } = req.body;

    if (!mongoose.Types.ObjectId.isValid(addressId)) {
      return res.status(400).json({ message: "Invalid address ID" });
    }

    const addressDoc = await Address.findOne({ _id: addressId, user: userId });
    if (!addressDoc) {
      return res.status(404).json({ message: "Address not found" });
    }

    const updatePayload = {};
    if (address !== undefined) updatePayload.address = address;
    if (city !== undefined) updatePayload.city = city;
    if (postalCode !== undefined) updatePayload.postalCode = postalCode;
    if (country !== undefined) updatePayload.country = country;
    if (phone !== undefined) updatePayload.phone = phone;

    if (Object.keys(updatePayload).length === 0 && isDefault !== true) {
      return res.status(400).json({ message: "No valid fields to update" });
    }

    if (isDefault === true && !addressDoc.isDefault) {
      await Address.updateMany(
        { user: userId },
        { $set: { isDefault: false } },
      );
      updatePayload.isDefault = true;
    }

    Object.assign(addressDoc, updatePayload);
    const updatedAddress = await addressDoc.save();

    res
      .status(200)
      .json({ message: "Address updated successfully", data: updatedAddress });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.deleteAddress = async (req, res) => {
  try {
    const userId = req.userId;
    const addressId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(addressId)) {
      return res.status(400).json({ message: "Invalid address ID" });
    }

    const deletedAddress = await Address.findOneAndDelete({
      _id: addressId,
      user: userId,
    });
    if (!deletedAddress) {
      return res.status(404).json({ message: "Address not found" });
    }

    if (deletedAddress.isDefault) {
      const fallbackAddress = await Address.findOne({ user: userId }).sort({
        createdAt: -1,
      });
      if (fallbackAddress) {
        fallbackAddress.isDefault = true;
        await fallbackAddress.save();
      }
    }

    res
      .status(200)
      .json({ message: "Address deleted successfully", data: deletedAddress });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.setDefaultAddress = async (req, res) => {
  try {
    const userId = req.userId;
    const addressId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(addressId)) {
      return res.status(400).json({ message: "Invalid address ID" });
    }

    const address = await Address.findOne({ _id: addressId, user: userId });
    if (!address) {
      return res.status(404).json({ message: "Address not found" });
    }

    if (address.isDefault) {
      return res
        .status(200)
        .json({ message: "Address is already the default", data: address });
    }

    await Address.updateMany({ user: userId }, { $set: { isDefault: false } });
    address.isDefault = true;
    await address.save();

    res
      .status(200)
      .json({ message: "Default address set successfully", data: address });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};
