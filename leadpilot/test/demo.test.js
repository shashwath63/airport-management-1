import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { bestAnswers, chat } from '../src/providers/demo.js';

const KB = `Bright Smile Dental is a family dental practice in Austin.
Teeth cleaning costs $99 and a whitening treatment costs $299.
We are open Monday to Friday 8am to 5pm and Saturday 9am to 1pm.
We accept most insurance plans including Delta Dental and Cigna.
Our office is located at 123 Main Street, Austin, with free parking behind the building.`;

const u = (content) => ({ role: 'user', content });
const a = (content) => ({ role: 'assistant', content });
const bot = { business_name: 'Bright Smile Dental', knowledge: KB, booking_url: 'https://book.example.com/x', phone: '512-555-0100' };

describe('bestAnswers', () => {
  test('price', () => assert.match(bestAnswers(KB, 'How much does a cleaning cost?')[0], /\$99/));
  test('hours', () => assert.match(bestAnswers(KB, 'What time are you open on Saturday?')[0], /open Monday to Friday/));
  test('insurance', () => assert.match(bestAnswers(KB, 'Do you accept Cigna insurance?')[0], /insurance plans/));
  test('location', () => assert.match(bestAnswers(KB, 'Where are you located?')[0], /123 Main Street/));
  test('empty question or knowledge gives []', () => {
    assert.deepEqual(bestAnswers(KB, 'the a an'), []);
    assert.deepEqual(bestAnswers('', 'price?'), []);
    assert.deepEqual(bestAnswers(null, 'price?'), []);
  });
  test('respects max', () => assert.ok(bestAnswers(KB, 'price hours insurance location', 1).length <= 1));
});

describe('demo chat()', () => {
  test('greets', async () => {
    const { reply, leads } = await chat(bot, [u('hi')]);
    assert.match(reply, /Hi there/);
    assert.match(reply, /Bright Smile Dental/);
    assert.deepEqual(leads, []);
  });
  test('answers from knowledge', async () => {
    const { reply } = await chat(bot, [u('How much is teeth whitening?')]);
    assert.match(reply, /\$299/);
  });
  test('booking intent includes booking link and asks for contact details', async () => {
    const { reply } = await chat(bot, [u('I want to book an appointment')]);
    assert.ok(reply.includes('https://book.example.com/x'));
    assert.match(reply, /best phone number or email/);
  });
  test('falls back to phone when no booking url', async () => {
    const { reply } = await chat({ ...bot, booking_url: '' }, [u('can I schedule a visit?')]);
    assert.ok(reply.includes('512-555-0100'));
  });
  test("doesn't ask for contact twice in a row", async () => {
    const first = await chat(bot, [u('I want to book an appointment')]);
    assert.match(first.reply, /best phone number or email/);
    const second = await chat(bot, [u('I want to book an appointment'), a(first.reply), u('can I book for Saturday?')]);
    assert.doesNotMatch(second.reply, /best phone number or email/);
  });
  test('does not ask once contact is known', async () => {
    const { reply } = await chat(bot, [u('my name is Jane, jane@x.com'), a('thanks'), u('I want to book an appointment')]);
    assert.doesNotMatch(reply, /best phone number or email/);
  });
  test('thanks by first name when contact given', async () => {
    const { reply } = await chat(bot, [u("I'm Sarah Lee, 415-555-0199")]);
    assert.match(reply, /^Thanks, Sarah!/);
    assert.ok(reply.includes('https://book.example.com/x'));
  });
  test('thanks without a name when only an email is given', async () => {
    const { reply } = await chat(bot, [u('jane@example.com')]);
    assert.match(reply, /^Thanks!/);
  });
  test('unknown question gets graceful fallback', async () => {
    const { reply } = await chat({ ...bot, knowledge: '' }, [u('Do you sell zeppelins?')]);
    assert.match(reply, /don't have that detail/);
  });
});
