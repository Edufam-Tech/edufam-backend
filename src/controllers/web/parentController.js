class ParentWebController {
  async getDashboard(req, res) { return res.json({ success: true, data: { widgets: [] } }); }
  async getChildren(req, res) { return res.json({ success: true, data: { children: [] } }); }
  async getChildAcademic(req, res) { return res.json({ success: true, data: { academic: {} } }); }
}

module.exports = new ParentWebController();


