import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { findEmail, findPhone, findName, urgencyOf, extractLead, hadContactBefore } from '../src/leadExtract.js';

const u = (content) => ({ role: 'user', content });
const a = (content) => ({ role: 'assistant', content });

describe('findEmail', () => {
  test('finds an email inside text', () => assert.equal(findEmail('reach me at jane.doe+x@mail.example.com please'), 'jane.doe+x@mail.example.com'));
  test('returns null when none', () => assert.equal(findEmail('no email here'), null));
});

describe('findPhone', () => {
  test('+1 (415) 555-0199', () => assert.equal(findPhone('call +1 (415) 555-0199 now'), '+1 (415) 555-0199'));
  test('415.555.0199', () => assert.equal(findPhone('it is 415.555.0199'), '415.555.0199'));
  test('plain 7-digit number', () => assert.equal(findPhone('555-0199'), '555-0199'));
  test('rejects short numbers like "2 cats"', () => assert.equal(findPhone('I have 2 cats'), null));
  test('rejects 6-digit numbers', () => assert.equal(findPhone('code 123456'), null));
  test('rejects more than 15 digits', () => assert.equal(findPhone('1234567890123456789'), null));
  test('does not match digits inside an email', () => assert.equal(findPhone('jane1234567@example.com'), null));
  test('finds phone next to an email', () => assert.equal(findPhone('a1234567@x.com or 415-555-0199'), '415-555-0199'));
});

describe('findName', () => {
  test('my name is Jane', () => assert.equal(findName('my name is Jane'), 'Jane'));
  test("I'm Sarah Lee, 415-555-0199", () => assert.equal(findName("I'm Sarah Lee, 415-555-0199"), 'Sarah Lee'));
  test('Tom, 555 222 3333', () => assert.equal(findName('Tom, 555 222 3333'), 'Tom'));
  test('name with email only', () => assert.equal(findName('jane doe - jane@x.com'), 'Jane Doe'));
  test('not a name: "I\'m looking for a dentist"', () => assert.equal(findName("I'm looking for a dentist"), null));
  test('not a name: "I am interested in whitening"', () => assert.equal(findName('I am interested in whitening'), null));
  test('bare word without contact info is not a name', () => assert.equal(findName('Tom'), null));
});

describe('urgencyOf', () => {
  test('today', () => assert.equal(urgencyOf('I need this ASAP'), 'today'));
  test('this_week', () => assert.equal(urgencyOf('sometime tomorrow'), 'this_week'));
  test('this_month', () => assert.equal(urgencyOf('maybe next week'), 'this_month'));
  test('just_browsing', () => assert.equal(urgencyOf('what do you do'), 'just_browsing'));
  test('most urgent wins', () => assert.equal(urgencyOf('soon, actually today'), 'today'));
});

describe('extractLead', () => {
  test('null with no contact info', () => assert.equal(extractLead([u('how much is a cleaning?'), a('$99'), u('ok thanks')]), null));
  test('null when contact only in an earlier message', () =>
    assert.equal(extractLead([u('me: a@b.com'), a('ok'), u('thanks a lot')]), null));
  test('picks name from earlier message, need from first substantive non-contact message', () => {
    const lead = extractLead([
      u('Hi'),
      a('Hello'),
      u('I want a teeth whitening quote'),
      a('Sure, who am I speaking with?'),
      u('my name is Jane'),
      a('Best contact?'),
      u('jane@example.com'),
    ]);
    assert.equal(lead.name, 'Jane');
    assert.equal(lead.email, 'jane@example.com');
    assert.equal(lead.phone, null);
    assert.equal(lead.need, 'I want a teeth whitening quote');
    assert.equal(lead.urgency, 'just_browsing');
  });
  test('defaults name to Website visitor and detects urgency', () => {
    const lead = extractLead([u('I need an emergency appointment today'), a('Contact?'), u('415-555-0199')]);
    assert.equal(lead.name, 'Website visitor');
    assert.equal(lead.phone, '415-555-0199');
    assert.equal(lead.urgency, 'today');
  });
  test('need is truncated to 200 chars', () => {
    const lead = extractLead([u('word '.repeat(100)), u('a@b.co')]);
    assert.equal(lead.need.length, 200);
  });
});

describe('hadContactBefore', () => {
  test('false with no earlier contact (latest message ignored)', () => assert.equal(hadContactBefore([u('hi'), a('yo'), u('a@b.com')]), false));
  test('true with earlier email', () => assert.equal(hadContactBefore([u('a@b.com'), a('ty'), u('hello')]), true));
  test('true with earlier phone', () => assert.equal(hadContactBefore([u('415-555-0199'), a('ty'), u('hello')]), true));
  test('assistant messages are ignored', () => assert.equal(hadContactBefore([a('mail us a@b.com'), u('hello')]), false));
});
