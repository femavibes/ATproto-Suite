import express from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import registerCompareRoutes from './routes/compare.js';
import registerSnapshotRoutes from './routes/snapshots.js';

const __dir = dirname(fileURLToPath(import.meta.url));
process.env.DATA_DIR = join(__dir, 'data');

const app = express();
app.use(express.json());
app.use(express.static(join(__dir, 'public')));

registerCompareRoutes(app);
registerSnapshotRoutes(app);

const PORT = process.env.PORT || 3500;
app.listen(PORT, () => console.log(`feed-compare running on http://localhost:${PORT}`));
