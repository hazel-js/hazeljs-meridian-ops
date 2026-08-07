import { buildGateFromModule } from '../src/skillgate/build-gate';
import { formatReport } from '../src/skillgate/wire-skills';

console.log(formatReport(buildGateFromModule().report()));
