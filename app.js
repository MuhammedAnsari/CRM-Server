const express = require('express');
const mongoose = require('mongoose');
const app = express();
const port = process.env.PORT || 5000;
const mongoURL = 'mongodb+srv://alkatefdb:RWA0VMWWN2OXT5OS@cluster0.7wz8ncf.mongodb.net/Al-Katef-CRM?retryWrites=true&w=majority';
const cors = require('cors');
const socketIo = require('socket.io');
const http = require('http');
const server = http.createServer(app);
const multer = require('multer');
const upload = multer();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(upload.any());

const corsOptions = {
  origin: 'http://localhost:3000',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));


// MongoDB connection using Mongoose
mongoose
  .connect(mongoURL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('Connected to MongoDB');

    const io = socketIo(server);

    // Create a WebSocket connection
    io.on('connection', (socket) => {
      console.log('A client connected');

      socket.on('clockIn', async (data) => {
        const { username, uid } = data; // Include UID in the data
        const clockInTime = new Date();

        try {
          const newAttendance = new Attendance({
            clockInTime,
            username,
            uid, // Store UID in the attendance record
          });

          await newAttendance.save();

          // Emit the clock-in event with UID
          io.emit(`updateClockIn_${uid}`, { clockInTime, username, uid });
          res.status(201).json(newAttendance);
        } catch (error) {
          console.error('Error clocking in:', error);
          res.status(500).send('Error clocking in');
        }
      });

      socket.on('clockOut', async (data) => {
        const { username, uid } = data; // Include UID in the data
        const clockOutTime = new Date();

        try {
          // Find the latest attendance record for the user and update the clockOutTime
          const latestAttendance = await Attendance.findOne({ username, uid }).sort({
            clockInTime: -1,
          });

          if (latestAttendance) {
            latestAttendance.clockOutTime = clockOutTime;
            await latestAttendance.save();

            // Emit the clock-out event with UID
            io.emit(`updateClockOut_${uid}`, { clockOutTime, username, uid });
            res.status(200).json(latestAttendance);
          } else {
            res.status(404).json({ message: 'No clock in record found for the user' });
          }
        } catch (error) {
          console.error('Error clocking out:', error);
          res.status(500).send('Error clocking out');
        }
      });

      socket.on('disconnect', () => {
        console.log('A client disconnected');
      });
    });

    // Admin Schema
    const adminSchema = new mongoose.Schema({
      username: String,
      password: String,
      role: String,
      name: String,
    });

    // Employees Schema
    const employeeSchema = new mongoose.Schema({
      uid: Number,
      name: String,
      email: String,
      role: String,
      password: String,
    });

    // Employees Schema
    const rolesSchema = new mongoose.Schema({
      rolename: String,
    });

    // Lead Schema
    const leadSchema = new mongoose.Schema({
      title: String,
      description: String,
      assignedUser: String,
      deadlineDays: Number,
      status: String,
      file: {
        data: Buffer,
        contentType: String,
        fileName: String,
      },
      addedAt: {
        type: Date,
        default: Date.now, // Set the default value to the current date and time
      },
    });

    // request schema
    const requestSchema = new mongoose.Schema({
      title: String,
      assignedUser: String,
      deadlineDays: Number,
    });


    const attendanceSchema = new mongoose.Schema({
      clockInTime: {
        type: Date,
        required: true,
      },
      clockOutTime: {
        type: Date,
        required: false,
      },
      username: String,
    });

    // mail schema
    const mailSchema = new mongoose.Schema({
      toUser: String,
      subject: String,
      message: String
    })


    // Models
    const AdminModel = mongoose.model('admins', adminSchema);
    const EmployeeModel = mongoose.model('employees', employeeSchema);
    const RoleModel = mongoose.model('roles', rolesSchema);
    const LeadModel = mongoose.model('leads', leadSchema);
    const Attendance = mongoose.model('Attendance', attendanceSchema);
    const MailModal = mongoose.model('Mails', mailSchema);
    const RequestModel = mongoose.model('Requests', requestSchema);

    // Routes
    app.post('/insert-admin', async (req, res) => {
      const adminData = req.body;
      try {
        const newAdmin = new AdminModel(adminData);
        await newAdmin.save();
        res.status(201).send('Admin inserted successfully');
      } catch (err) {
        console.error('Error inserting admin:', err);
        res.status(500).send('Error inserting admin');
      }
    });

    // Login route for admins
    app.post('/admin-login', async (req, res) => {
      const { username, password } = req.body;
      try {
        const admin = await AdminModel.findOne({ username, password });

        if (admin) {
          // Include the 'name' field in the response
          const { role, name } = admin;
          res.status(200).json({ role, name, message: 'Admin login successful' });
        } else {
          res.status(401).json({ message: 'Admin login failed' });
        }
      } catch (err) {
        console.error('Error during admin login:', err);
        res.status(500).send('Error during admin login');
      }
    });

    // Fetch all admin details
    app.get('/admin', async (req, res) => {
      try {
        const admins = await AdminModel.find();
        res.json(admins);
      } catch (err) {
        console.error('Error retrieving admin details:', err);
        res.status(500).send('Error retrieving admin details');
      }
    });

    app.post('/insert-employee', async (req, res) => {
      const employeeData = req.body;
      try {
        const newEmployee = new EmployeeModel(employeeData);
        await newEmployee.save();
        res.status(201).send('Employee inserted successfully');
      } catch (err) {
        console.error('Error inserting employee:', err);
        res.status(500).send('Error inserting employee');
      }
    });

    // employee details fetch
    app.get('/employees', async (req, res) => {
      try {
        const employees = await EmployeeModel.find();
        res.json(employees);

      } catch (err) {
        console.error('Error retrieving employees:', err);
        res.status(500).send('Error retrieving employees');
      }
    });

    // employee login
    app.post('/employee-login', async (req, res) => {
      const { email, password } = req.body;
      try {
        // Check if an employee with the provided email and password exists
        const employee = await EmployeeModel.findOne({ email, password });

        if (employee) {
          // Include employee details in the response
          const { name, role } = employee;
          res.status(200).json({ name, role, message: 'Employee login successful' });
        } else {
          res.status(401).json({ message: 'Employee login failed' });
        }
      } catch (err) {
        console.error('Error during employee login:', err);
        res.status(500).send('Error during employee login');
      }
    });

    // edit employee
    app.put('/update-employee/:id', async (req, res) => {
      const employeeId = req.params.id;
      const updatedEmployeeData = req.body;
      try {
        // Find the employee by ID and update their details
        const updatedEmployee = await EmployeeModel.findByIdAndUpdate(
          employeeId,
          updatedEmployeeData,
          { new: true }
        );

        if (updatedEmployee) {
          res.status(200).json(updatedEmployee);
        } else {
          res.status(404).json({ message: 'Employee not found' });
        }
      } catch (err) {
        console.error('Error updating employee:', err);
        res.status(500).send('Error updating employee');
      }
    });

    // fetch roles
    app.get('/roles', async (req, res) => {
      try {
        const roles = await RoleModel.find();

        res.json(roles);
      } catch (error) {
        console.error('Error fetching roles:', error);
        res.status(500).json({ message: 'Error fetching roles' });
      }
    });

    // add new roles
    app.post('/add-role', async (req, res) => {
      const { rolename } = req.body;
      try {
        const newRole = new RoleModel({ rolename });
        await newRole.save();
        res.status(201).json(newRole);
      } catch (err) {
        console.error('Error adding role:', err);
        res.status(500).send('Error adding role');
      }
    });

    // delete role
    app.delete('/remove-role/:id', async (req, res) => {
      const roleId = req.params.id;
      try {
        await RoleModel.findByIdAndDelete(roleId);
        res.status(200).json({ message: 'Role removed successfully' });
      } catch (err) {
        console.error('Error removing role:', err);
        res.status(500).send('Error removing role');
      }
    });


    // add lead
    app.post('/insert-lead', async (req, res) => {
      const leadData = req.body;
      const { title, description, selectedUser, deadlineDays, status } = leadData;
    
      // Handle the uploaded file(s) using multer
      const files = req.files;
    
      try {
        // Convert the deadlineDays field to a number
        const parsedDeadlineDays = parseFloat(deadlineDays);
    
        if (isNaN(parsedDeadlineDays)) {
          // Handle the case where deadlineDays is not a valid number
          return res.status(400).json({ message: 'Invalid deadlineDays' });
        }
    
        // Create a new lead object with the selected user's name and other fields
        const newLead = new LeadModel({
          title,
          description,
          assignedUser: selectedUser,
          deadlineDays: parsedDeadlineDays,
          status,
        });
    
        // Check if a file was provided in the request
        if (files && files.length > 0) {
          newLead.file = {
            data: Buffer.from(files[0].buffer),
            contentType: files[0].mimetype,
            fileName: files[0].originalname,
          };
        }
    
        // Save the lead object to the database
        const insertedLead = await newLead.save();
    
        // Send a response
        res.status(201).json(insertedLead);
      } catch (err) {
        console.error('Error inserting lead:', err);
        res.status(500).send('Error inserting lead');
      }
    });
    
    // fetch leads
    app.get('/leads', async (req, res) => {
      try {
        const leads = await LeadModel.find();

        // Check if the client requested a file download
        const download = req.query.download;

        if (download) {
          const leadId = req.query.leadId;
          const lead = leads.find((lead) => lead._id.toString() === leadId);

          if (!lead) {
            return res.status(404).json({ message: 'Lead not found' });
          }

          // Set appropriate response headers for download
          res.setHeader('Content-Type', lead.file.contentType);
          res.setHeader('Content-Disposition', `attachment; filename=${lead.file.fileName}`);

          // Send the file data as a response
          res.send(lead.file.data);
        } else {
          // If not a download request, return the list of leads
          res.json(leads);
        }
      } catch (error) {
        console.error('Error retrieving leads:', error);
        res.status(500).send('Error retrieving leads');
      }
    });

    // Fetch lead by ID
    app.get('/leads/:leadId', async (req, res) => {
      try {
        const leadId = req.params.leadId.trim(); // Clean and extract the leadId
        const lead = await LeadModel.findById(leadId);
    
        if (!lead) {
          return res.status(404).json({ message: 'Lead not found' });
        }
    
        // Return the lead data
        res.json(lead);
      } catch (error) {
        console.error('Error retrieving lead by ID:', error);
        res.status(500).send('Error retrieving lead');
      }
    });
    
    // give request
    app.post('/requests', async (req, res) => {
      const { title, assignedUser, deadlineDays } = req.body;
    
      try {
        const newRequest = new RequestModel({ title, assignedUser, deadlineDays });
        const savedRequest = await newRequest.save(); // Use await to handle the promise
        res.status(201).json(savedRequest);
      } catch (err) {
        console.error('Error creating a new request:', err);
        res.status(500).json({ error: 'Failed to create a new request' });
      }
    });

    // fetch request
    app.get('/view-request', async (req, res) => {
      try {
        // Fetch all data from the "Requests" collection
        const requests = await RequestModel.find();
    
        // Send the requests data as a JSON response
        res.json(requests);
      } catch (error) {
        console.error('Error fetching requests:', error);
        res.status(500).json({ error: 'Failed to fetch requests' });
      }
    });
    

    // Update lead
    app.put('/update-lead/:id', async (req, res) => {
      const leadId = req.params.id;
      const updatedLeadData = req.body;
      try {

        const updatedLead = await LeadModel.findByIdAndUpdate(
          leadId,
          updatedLeadData,
          { new: true }
        );

        if (updatedLead) {
          res.status(200).json(updatedLead);
        } else {
          res.status(404).json({ message: 'Lead not found' });
        }
      } catch (err) {
        console.error('Error updating lead:', err);
        res.status(500).send('Error updating lead');
      }
    });

    // Update lead status
    app.put('/update-lead-status/:leadId', async (req, res) => {
      try {
        const leadId = req.params.leadId;
        const { status } = req.body;

        // Find the lead by ID and update its status
        const updatedLead = await LeadModel.findByIdAndUpdate(
          leadId,
          { status },
          { new: true }
        );

        if (updatedLead) {
          res.status(200).json(updatedLead);
        } else {
          res.status(404).json({ message: 'Lead not found' });
        }
      } catch (err) {
        console.error('Error updating lead status:', err);
        res.status(500).send('Error updating lead status');
      }
    });


    // delete leads
    app.delete('/delete-lead/:leadId', async (req, res) => {
      try {
        const leadId = req.params.leadId;

        // Use Mongoose to find and remove the lead by its ID
        const deletedLead = await LeadModel.findByIdAndRemove(leadId);

        if (!deletedLead) {
          return res.status(404).json({ message: 'Lead not found' });
        }

        return res.status(200).json({ message: 'Lead deleted successfully' });
      } catch (error) {
        console.error('Error deleting lead:', error);
        return res.status(500).json({ message: 'Internal server error' });
      }
    });

    // Create an endpoint for clock in
    app.post('/clock-in', async (req, res) => {
      const { username, uid } = req.body; // Include UID in the request body
      const clockInTime = new Date();

      try {
        const newAttendance = new Attendance({
          clockInTime,
          username,
          uid, // Store UID in the attendance record
        });

        await newAttendance.save();
        // Emit the clock-in event with UID
        io.emit(`updateClockIn_${uid}`, { clockInTime, username, uid });
        res.status(201).json(newAttendance);
      } catch (error) {
        console.error('Error clocking in:', error);
        res.status(500).send('Error clocking in');
      }
    });

    // Create an endpoint for clock out
    app.post('/clock-out', async (req, res) => {
      const { username, uid } = req.body; // Include UID in the request body
      const clockOutTime = new Date();

      try {
        // Find the latest attendance record for the user and update the clockOutTime
        const latestAttendance = await Attendance.findOne({ username, uid }).sort({
          clockInTime: -1,
        });

        if (latestAttendance) {
          latestAttendance.clockOutTime = clockOutTime;
          await latestAttendance.save();
          // Emit the clock-out event with UID
          io.emit(`updateClockOut_${uid}`, { clockOutTime, username, uid });
          res.status(200).json(latestAttendance);
        } else {
          res.status(404).json({ message: 'No clock in record found for the user' });
        }
      } catch (error) {
        console.error('Error clocking out:', error);
        res.status(500).send('Error clocking out');
      }
    });

    // fetch attendance
    app.get('/attendance', async (req, res) => {
      try {
        // Query the database to find all attendance records
        const allAttendanceDetails = await Attendance.find();

        return res.json(allAttendanceDetails);
      } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal server error' });
      }
    });

    // store mail in db
    app.post('/mails', async (req, res) => {
      const { toUser, subject, message } = req.body;

      // Create a new MailModal instance with the data
      const newMail = new MailModal({ toUser, subject, message });

      try {
        // Save the data to the database and await the result
        await newMail.save();
        res.status(201).json({ message: 'Mail saved successfully' });
      } catch (error) {
        console.error('Error saving mail:', error);
        res.status(500).json({ error: 'Error saving mail' });
      }
    });

    // fetch mail
    app.get('/fetchmail', async (req, res) => {
      try {

        const mails = await MailModal.find();

        res.status(200).json({ success: true, data: mails });
      } catch (error) {
        console.error('Error fetching mails:', error);
        res.status(500).json({ success: false, error: 'Error fetching mails' });
      }
    });


    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  })
  .catch(error => {
    console.error('Error connecting to MongoDB:', error);
  });