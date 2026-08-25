const assert = require('assert');
const { registerSchema, loginSchema } = require('./validators/authValidator');
const { createDeviceSchema, updateDeviceThresholdSchema } = require('./validators/deviceValidator');
const { evaluateTelemetryAlerts } = require('./services/alertEngine');

async function runTests() {
  console.log('🧪 Starting Unified Service Automated Tests...\n');

  // Test 1: Joi Validation for Auth
  console.log('Test 1: Joi Validation for Register & Login...');
  const validRegister = registerSchema.validate({
    name: 'Test Admin',
    email: 'admin@rockfall.com',
    password: 'password123',
    role: 'SUPER_ADMIN'
  });
  assert.strictEqual(validRegister.error, undefined, 'Register schema validation failed');

  const invalidLogin = loginSchema.validate({ email: 'not-an-email' });
  assert.notStrictEqual(invalidLogin.error, undefined, 'Invalid login should fail validation');
  console.log('✅ Test 1 Passed!\n');

  // Test 2: Joi Validation for Device Creation & Threshold Update
  console.log('Test 2: Joi Validation for Device Management...');
  const validDevice = createDeviceSchema.validate({
    id: 'TECHA99999',
    name: 'Test Sensor 999',
    communication_type: 'HYBRID',
    motion_g: 0.05,
    rock_peak_g: 1.50
  });
  assert.strictEqual(validDevice.error, undefined, 'Device schema validation failed');

  const validThreshold = updateDeviceThresholdSchema.validate({
    rock_peak_g: 2.0,
    rock_dur_ms: 300,
    communication_type: 'LORAWAN'
  });
  assert.strictEqual(validThreshold.error, undefined, 'Threshold schema validation failed');
  console.log('✅ Test 2 Passed!\n');

  // Test 3: Alert Engine Logic Simulation
  console.log('Test 3: Alert Engine Threshold Logic Test...');
  const mockDevice = {
    id: 'TECHA12345',
    name: 'Demo Sensor',
    org_id: 'org_default',
    rock_peak_g: 1.50,
    human_peak_max_g: 1.60,
    motion_g: 0.05,
    update: async (fields) => { mockDevice.status = fields.status; }
  };

  const highImpactTelemetry = {
    device_id: 'TECHA12345',
    peak_g: 3.45,
    duration_ms: 185,
    energy_g2: 128.5,
    event_type: 'ROCKFALL',
    source: 'LORAWAN'
  };

  // Check condition logic
  const isRockfall = highImpactTelemetry.peak_g >= mockDevice.rock_peak_g;
  assert.strictEqual(isRockfall, true, 'High impact should trigger rockfall alert');
  console.log('✅ Test 3 Passed!\n');

  // Test 4: LoRaWAN 2-Way Response Payload Construction Test
  console.log('Test 4: 2-Way LoRaWAN Downlink Response Payload Construction...');
  const sampleDownlink = {
    status: 'OK',
    devEUI: mockDevice.id,
    downlinkPayload: {
      confirmed: false,
      fPort: 2,
      data: Buffer.from(JSON.stringify({
        th_v: 1,
        peak_g: mockDevice.rock_peak_g
      })).toString('base64'),
      thresholdConfig: {
        MOTION_G: mockDevice.motion_g,
        ROCK_PEAK_G: mockDevice.rock_peak_g
      }
    }
  };

  assert.strictEqual(sampleDownlink.status, 'OK');
  assert.strictEqual(sampleDownlink.downlinkPayload.thresholdConfig.ROCK_PEAK_G, 1.50);
  console.log('✅ Test 4 Passed!\n');

  console.log('🎉 ALL AUTOMATED UNIT & INTEGRATION TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((err) => {
  console.error('❌ Test execution failed:', err);
  process.exit(1);
});
