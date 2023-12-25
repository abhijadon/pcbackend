const mongoose = require('mongoose');
const moment = require('moment');

const Model = mongoose.model('Payment');

const getTotalPaymentAmount = async () => {
  try {
    const result = await Model.aggregate([
      {
        $group: {
          _id: null,
          totalPaidAmount: { $sum: '$total_paid_amount' },
        },
      },
    ]);

    return result.length > 0 ? result[0].totalPaidAmount : 0;
  } catch (error) {
    console.error('Error fetching total payment amount:', error);
    throw error;
  }
};

const summary = async (req, res) => {
  try {
    let defaultType = 'month';
    const { type, institute_name, university_name } = req.query;

    if (type && ['week', 'month', 'year'].includes(type)) {
      defaultType = type;
    }

    const currentDate = moment();
    const startDate = currentDate.clone().startOf(defaultType);
    const endDate = currentDate.clone().endOf(defaultType);

    const matchQuery = {
      removed: false,
      date: {
        $gte: startDate.toDate(),
        $lte: endDate.toDate(),
      },
    };

    if (institute_name) {
      matchQuery.institute_name = institute_name;
    }

    if (university_name) {
      matchQuery.university_name = university_name;
    }

    const result = await Model.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          total_paid_amount: { $sum: '$total_paid_amount' },
          paid_amount: { $sum: '$paid_amount' },
        },
      },
      {
        $project: {
          _id: 0,
          count: 1,
          total_paid_amount: 1,
          paid_amount: 1,
          due_amount: { $subtract: ['$total_paid_amount', '$paid_amount'] },
        },
      },
    ]);
    const instituteData = await Model.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$institute_name',
          total_paid_amount: { $sum: '$total_paid_amount' },
          paid_amount: { $sum: '$paid_amount' },
          total: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 1,
          count: 1,
          total_paid_amount: 1,
          paid_amount: 1,
          due_amount: { $subtract: ['$total_paid_amount', '$paid_amount'] },
        },
      },
    ]);

    const universityData = await Model.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$university_name',
          total_paid_amount: { $sum: '$total_paid_amount' },
          paid_amount: { $sum: '$paid_amount' },
          total: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 1,
          count: 1,
          total_paid_amount: 1,
          paid_amount: 1,
          due_amount: { $subtract: ['$total_paid_amount', '$paid_amount'] },
        },
      },
    ]);
    const totalPaymentAmount = await getTotalPaymentAmount();

    const formattedInstituteData = instituteData.map((data) => ({
      tag: data._id || 'Unknown Institute',
      value: data.total,
      totalPaidAmount: data.total_paid_amount,
      paidAmount: data.paid_amount,
      DueAmount: data.due_amount,
      // Add color property here if needed
    }));
    const formattedUniversityData = universityData.map((data) => ({
      tag: data._id || 'Unknown University',
      value: data.total,
      totalPaidAmount: data.total_paid_amount,
      paidAmount: data.paid_amount,
      DueAmount: data.due_amount,
      // Add color property here if needed
    }));

    const summaryResult =
      result.length > 0
        ? { ...result[0], totalPaymentAmount }
        : {
            count: 0,
            total_paid_amount: 0,
            paid_amount: 0,
            due_amount: 0,
            totalPaymentAmount,
          };

    // Check if universityData is empty (meaning the university doesn't exist in the dataset)
    if (universityData.length === 0 && university_name) {
      return res.status(200).json({
        success: true,
        result: null,
        instituteData: formattedInstituteData,
        universityData: formattedUniversityData,
        message: `The specified university (${university_name}) does not exist in the dataset.`,
      });
    }

    // Return the summary data
    return res.status(200).json({
      success: true,
      result: summaryResult,
      instituteData: formattedInstituteData,
      universityData: formattedUniversityData,
      message: `Successfully fetched the summary of payment invoices for the last ${defaultType}`,
    });
  } catch (error) {
    console.error('Error in summary:', error);
    return res.status(500).json({
      success: false,
      result: null,
      message: error.message,
      error: error,
    });
  }
};

module.exports = summary;
