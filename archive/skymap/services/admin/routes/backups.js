const express = require('express');

module.exports = (pool) => {
  const router = express.Router();

  // List all backups from GCS
  router.get('/', async (req, res) => {
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      const bucket = process.env.GCS_BUCKET_NAME;
      if (!bucket) {
        return res.status(500).json({ error: 'GCS_BUCKET_NAME not configured' });
      }
      
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        await execAsync(`gcloud auth activate-service-account --key-file=${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
      }
      
      const { stdout } = await execAsync(`gsutil ls -l gs://${bucket}/backups/**/*.sql.gz`);
      
      const backups = [];
      const lines = stdout.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        const match = line.match(/gs:\/\/([^\/]+)\/backups\/([^\/]+)\/(daily|weekly|monthly)\/([^\/]+)\.sql\.gz/);
        if (match) {
          const [, , database, type, filename] = match;
          const sizeMatch = line.match(/(\d+)\s+(\d{4}-\d{2}-\d{2})/);
          const size = sizeMatch ? parseInt(sizeMatch[1]) : 0;
          const date = sizeMatch ? sizeMatch[2] : filename.match(/(\d{4}-\d{2}-\d{2})/)?.[1] || '';
          
          backups.push({
            database,
            type,
            filename: `${filename}.sql.gz`,
            size,
            date,
            gcs_uri: `gs://${bucket}/backups/${database}/${type}/${filename}.sql.gz`,
            download_url: `/api/backups/download?database=${database}&type=${type}&filename=${filename}.sql.gz`
          });
        }
      }
      
      backups.sort((a, b) => b.date.localeCompare(a.date));
      
      res.json({ backups });
    } catch (error) {
      console.error('Error listing backups:', error);
      res.status(500).json({ error: 'Failed to list backups', details: error.message });
    }
  });

  // Download backup
  router.get('/download', async (req, res) => {
    try {
      const { database, type, filename } = req.query;
      
      if (!database || !type || !filename) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }
      
      const bucket = process.env.GCS_BUCKET_NAME;
      if (!bucket) {
        return res.status(500).json({ error: 'GCS_BUCKET_NAME not configured' });
      }
      
      const gcsUri = `gs://${bucket}/backups/${database}/${type}/${filename}.sql.gz`;
      
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        await execAsync(`gcloud auth activate-service-account --key-file=${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
      }
      
      const { stdout } = await execAsync(`gsutil signurl -d 1h ${process.env.GOOGLE_APPLICATION_CREDENTIALS || ''} ${gcsUri}`);
      const signedUrl = stdout.trim().split('\n').pop().split(/\s+/).pop();
      
      res.json({ download_url: signedUrl });
    } catch (error) {
      console.error('Error generating download URL:', error);
      res.status(500).json({ error: 'Failed to generate download URL', details: error.message });
    }
  });

  // Trigger manual backup
  router.post('/trigger', async (req, res) => {
    try {
      const { exec } = require('child_process');
      
      exec('docker exec skymap-backup-service-1 /scripts/backup.sh', (error, stdout, stderr) => {
        if (error) {
          console.error('Error triggering backup:', error, stderr);
          return res.status(500).json({ error: 'Failed to trigger backup', details: stderr });
        }
        
        res.json({ success: true, message: 'Backup triggered successfully', output: stdout });
      });
    } catch (error) {
      console.error('Error triggering backup:', error);
      res.status(500).json({ error: 'Failed to trigger backup', details: error.message });
    }
  });

  // Get backup schedule
  router.get('/schedule', async (req, res) => {
    try {
      const schedule = process.env.BACKUP_SCHEDULE || '0 2 * * *';
      const retention = {
        daily: parseInt(process.env.BACKUP_RETENTION_DAILY || '7'),
        weekly: parseInt(process.env.BACKUP_RETENTION_WEEKLY || '4'),
        monthly: parseInt(process.env.BACKUP_RETENTION_MONTHLY || '3')
      };
      
      res.json({ schedule, retention });
    } catch (error) {
      console.error('Error getting schedule:', error);
      res.status(500).json({ error: 'Failed to get schedule' });
    }
  });

  // Update backup schedule
  router.post('/schedule', async (req, res) => {
    try {
      const { schedule, retention } = req.body;
      
      res.json({ 
        success: true, 
        message: 'Schedule update requires manual .env file update and service restart',
        note: 'Update BACKUP_SCHEDULE, BACKUP_RETENTION_DAILY, BACKUP_RETENTION_WEEKLY, BACKUP_RETENTION_MONTHLY in .env and restart backup-service'
      });
    } catch (error) {
      console.error('Error updating schedule:', error);
      res.status(500).json({ error: 'Failed to update schedule' });
    }
  });

  // Get backup service status
  router.get('/status', async (req, res) => {
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      try {
        const { stdout } = await execAsync('docker ps --filter "name=backup-service" --format "{{.Status}}"');
        const isRunning = stdout.trim().length > 0;
        
        let lastBackup = null;
        try {
          const { stdout: logOutput } = await execAsync('docker exec skymap-backup-service-1 tail -n 20 /var/log/backups/cron.log 2>/dev/null || echo ""');
          const logLines = logOutput.split('\n').filter(line => line.includes('Starting backup process'));
          if (logLines.length > 0) {
            lastBackup = logLines[logLines.length - 1];
          }
        } catch (e) {
          // Log file might not exist yet
        }
        
        res.json({
          service_running: isRunning,
          last_backup: lastBackup,
          schedule: process.env.BACKUP_SCHEDULE || '0 2 * * *'
        });
      } catch (error) {
        res.json({
          service_running: false,
          error: 'Could not check service status'
        });
      }
    } catch (error) {
      console.error('Error getting backup status:', error);
      res.status(500).json({ error: 'Failed to get backup status' });
    }
  });

  // Get backup logs
  router.get('/logs', async (req, res) => {
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      const { stdout } = await execAsync('docker exec skymap-backup-service-1 tail -n 100 /var/log/backups/cron.log 2>/dev/null || echo "No logs available"');
      
      res.json({ logs: stdout });
    } catch (error) {
      console.error('Error getting backup logs:', error);
      res.status(500).json({ error: 'Failed to get backup logs', details: error.message });
    }
  });

  return router;
};
