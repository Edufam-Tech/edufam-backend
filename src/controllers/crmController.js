const crmService = require('../services/crmService');
const { asyncHandler, ValidationError } = require('../middleware/errorHandler');

class CrmController {
  createLead = asyncHandler(async (req, res) => {
    const { name, email, phone, source, status } = req.body;
    if (!name) throw new ValidationError('Name is required');
    const lead = await crmService.createLead({ name, email, phone, source, status, ownerId: req.user?.userId });
    res.status(201).json({ success: true, data: { lead }, message: 'Lead created' });
  });

  getLeads = asyncHandler(async (req, res) => {
    const { search, status, page, limit } = req.query;
    const leads = await crmService.getLeads({ search, status, page, limit });
    res.json({ success: true, data: { leads }, message: 'Leads retrieved' });
  });

  updateLeadStatus = asyncHandler(async (req, res) => {
    const { leadId } = req.params;
    const { status } = req.body;
    if (!status) throw new ValidationError('Status is required');
    const lead = await crmService.updateLeadStatus(leadId, status);
    res.json({ success: true, data: { lead }, message: 'Lead status updated' });
  });

  getAnalytics = asyncHandler(async (req, res) => {
    const analytics = await crmService.getAnalytics();
    res.json({ success: true, data: analytics, message: 'CRM analytics retrieved' });
  });
}

module.exports = new CrmController();


