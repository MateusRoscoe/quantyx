import { EventMessage } from './validators';

describe('Validators', () => {
  describe('EventMessage', () => {
    it('should pass validation for valid event message', () => {
      const validMessage = { eventType: 'USER_SIGNUP' };
      expect(() => EventMessage.parse(validMessage)).not.toThrow();
    });

    it('should fail validation for empty eventType', () => {
      const invalidMessage = { eventType: '' };
      expect(() => EventMessage.parse(invalidMessage)).toThrow();
    });
  });
});
