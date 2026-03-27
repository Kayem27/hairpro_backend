// Test the validatePassword function from auth route
// We need to extract the logic since it's inline in the router file

describe('validatePassword (logique auth)', () => {
  // Reproducing the function from routes/auth.js
  function validatePassword(password) {
    const errors = [];
    if (password.length < 8) errors.push('au moins 8 caractères');
    if (!/[A-Z]/.test(password)) errors.push('une lettre majuscule');
    if (!/[a-z]/.test(password)) errors.push('une lettre minuscule');
    if (!/[0-9]/.test(password)) errors.push('un chiffre');
    if (!/[^A-Za-z0-9]/.test(password)) errors.push('un caractère spécial (!@#$%...)');
    return errors;
  }

  test('devrait accepter un mot de passe fort', () => {
    expect(validatePassword('MyP@ssw0rd')).toHaveLength(0);
  });

  test('devrait rejeter un mot de passe trop court', () => {
    const errors = validatePassword('Aa1!');
    expect(errors).toContain('au moins 8 caractères');
  });

  test('devrait exiger une majuscule', () => {
    const errors = validatePassword('myp@ssw0rd');
    expect(errors).toContain('une lettre majuscule');
  });

  test('devrait exiger une minuscule', () => {
    const errors = validatePassword('MYP@SSW0RD');
    expect(errors).toContain('une lettre minuscule');
  });

  test('devrait exiger un chiffre', () => {
    const errors = validatePassword('MyP@ssword');
    expect(errors).toContain('un chiffre');
  });

  test('devrait exiger un caractère spécial', () => {
    const errors = validatePassword('MyPassw0rd');
    expect(errors).toContain('un caractère spécial (!@#$%...)');
  });

  test('devrait retourner plusieurs erreurs si nécessaire', () => {
    const errors = validatePassword('abc');
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });

  test('devrait accepter des caractères spéciaux variés', () => {
    const specialChars = ['!', '@', '#', '$', '%', '&', '*', '-', '_'];
    for (const char of specialChars) {
      expect(validatePassword(`MyPassw0rd${char}`)).toHaveLength(0);
    }
  });
});
