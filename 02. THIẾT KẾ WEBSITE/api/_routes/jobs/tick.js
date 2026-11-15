import { endpoint } from '../../_lib/http.js';
import { verifyJobsSecret, runJobs } from '../../_lib/jobs.js';

// GET, POST /api/jobs/tick
export default endpoint({
  path: '/api/jobs/tick',
  methods: ['GET', 'POST'],
  auth: false,
  internal: true,
  handler: async ({ req }) => {
    verifyJobsSecret(req);
    return runJobs();
  },
});
