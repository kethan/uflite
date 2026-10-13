import { describe, it, expect } from 'bun:test'
import { createACL } from '../src/services/acl.js'

const acl = rules =>
  createACL({
    enabled: true,
    rules
  })

const allow = (rules, context, permission) =>
  expect(acl(rules).can(context, permission)).toBe(true)

const deny = (rules, context, permission) =>
  expect(acl(rules).can(context, permission)).toBe(false)

describe('ACL', () => {

  // ─────────────────────────────────────────────
  // Basic authorization
  // ─────────────────────────────────────────────

  describe('basic authorization', () => {
    it('allows an exact permission', () => {
      allow(
        [{ id: '1', permissions: ['admin:users:delete'] }],
        {},
        'admin:users:delete'
      )
    })

    it('denies a different method', () => {
      deny(
        [{ id: '1', permissions: ['admin:users:delete'] }],
        {},
        'admin:users:update'
      )
    })

    it('denies a different resource', () => {
      deny(
        [{ id: '1', permissions: ['admin:users:delete'] }],
        {},
        'admin:posts:delete'
      )
    })

    it('denies a different role', () => {
      deny(
        [{ id: '1', permissions: ['admin:users:delete'] }],
        {},
        'user:users:delete'
      )
    })

    it('denies when no rules exist', () => {
      deny([], {}, 'user:posts:read')
    })

    it('denies when no rule matches', () => {
      deny(
        [{ id: '1', permissions: ['admin:users:delete'] }],
        {},
        'user:posts:read'
      )
    })

    it('allows a rule without a check', () => {
      allow(
        [{ id: '1', permissions: ['admin:users:delete'] }],
        {},
        'admin:users:delete'
      )
    })
  })


  // ─────────────────────────────────────────────
  // Multiple permissions in one rule
  // ─────────────────────────────────────────────

  describe('permissions', () => {
    const rules = [
      {
        id: '1',
        name: 'Post owner',
        permissions: [
          'user:posts:update',
          'user:posts:remove'
        ],
        check: {
          'user.id': 10
        }
      }
    ]

    it('allows first permission', () => {
      allow(rules, { user: { id: 10 } }, 'user:posts:update')
    })

    it('allows second permission', () => {
      allow(rules, { user: { id: 10 } }, 'user:posts:remove')
    })

    it('denies unrelated permission', () => {
      deny(rules, { user: { id: 10 } }, 'user:posts:create')
    })

    it('applies the same check to every listed permission', () => {
      deny(rules, { user: { id: 20 } }, 'user:posts:update')
      deny(rules, { user: { id: 20 } }, 'user:posts:remove')
    })

    it('allows duplicate permissions without changing behavior', () => {
      allow(
        [{
          id: '1',
          permissions: [
            'user:posts:update',
            'user:posts:update'
          ]
        }],
        {},
        'user:posts:update'
      )
    })
  })


  // ─────────────────────────────────────────────
  // Multiple ACL rules
  // ─────────────────────────────────────────────

  describe('multiple rules', () => {
    it('treats rules as OR', () => {
      allow(
        [
          {
            id: '1',
            permissions: ['admin:users:delete']
          },
          {
            id: '2',
            permissions: ['admin:users:update']
          }
        ],
        {},
        'admin:users:update'
      )
    })

    it('continues checking after a matching rule fails its check', () => {
      allow(
        [
          {
            id: '1',
            permissions: ['user:posts:update'],
            check: {
              'user.role': 'editor'
            }
          },
          {
            id: '2',
            permissions: ['user:posts:update'],
            check: {
              'user.role': 'owner'
            }
          }
        ],
        {
          user: {
            role: 'owner'
          }
        },
        'user:posts:update'
      )
    })

    it('denies when all matching rules fail their checks', () => {
      deny(
        [
          {
            id: '1',
            permissions: ['user:posts:update'],
            check: {
              'user.role': 'editor'
            }
          },
          {
            id: '2',
            permissions: ['user:posts:update'],
            check: {
              'user.role': 'admin'
            }
          }
        ],
        {
          user: {
            role: 'user'
          }
        },
        'user:posts:update'
      )
    })

    it('ignores rules for unrelated permissions', () => {
      allow(
        [
          {
            id: '1',
            permissions: ['admin:users:delete'],
            check: {
              impossible: true
            }
          },
          {
            id: '2',
            permissions: ['user:posts:read']
          }
        ],
        {},
        'user:posts:read'
      )
    })
  })


  // ─────────────────────────────────────────────
  // Wildcards
  // ─────────────────────────────────────────────

  describe('wildcards', () => {
    it('supports wildcard role', () => {
      allow(
        [{ id: '1', permissions: ['*:posts:read'] }],
        {},
        'user:posts:read'
      )

      allow(
        [{ id: '1', permissions: ['*:posts:read'] }],
        {},
        'admin:posts:read'
      )
    })

    it('supports wildcard resource', () => {
      allow(
        [{ id: '1', permissions: ['admin:*:read'] }],
        {},
        'admin:users:read'
      )

      allow(
        [{ id: '1', permissions: ['admin:*:read'] }],
        {},
        'admin:posts:read'
      )
    })

    it('supports wildcard method', () => {
      allow(
        [{ id: '1', permissions: ['admin:users:*'] }],
        {},
        'admin:users:create'
      )

      allow(
        [{ id: '1', permissions: ['admin:users:*'] }],
        {},
        'admin:users:update'
      )

      allow(
        [{ id: '1', permissions: ['admin:users:*'] }],
        {},
        'admin:users:delete'
      )
    })

    it('supports complete wildcard', () => {
      allow(
        [{ id: '1', permissions: ['*:*:*'] }],
        {},
        'anything:anything:anything'
      )
    })

    it('does not partially match wildcard patterns', () => {
      deny(
        [{ id: '1', permissions: ['admin:*:*'] }],
        {},
        'user:users:delete'
      )

      deny(
        [{ id: '1', permissions: ['*:users:*'] }],
        {},
        'admin:posts:delete'
      )

      deny(
        [{ id: '1', permissions: ['*:*:delete'] }],
        {},
        'admin:users:update'
      )
    })
  })


  // ─────────────────────────────────────────────
  // Conditions
  // ─────────────────────────────────────────────

  describe('checks', () => {
    it('allows when check passes', () => {
      allow(
        [{
          id: '1',
          permissions: ['admin:users:delete'],
          check: {
            'user.role': 'admin'
          }
        }],
        {
          user: { role: 'admin' }
        },
        'admin:users:delete'
      )
    })

    it('denies when check fails', () => {
      deny(
        [{
          id: '1',
          permissions: ['admin:users:delete'],
          check: {
            'user.role': 'admin'
          }
        }],
        {
          user: { role: 'user' }
        },
        'admin:users:delete'
      )
    })

    it('supports nested context', () => {
      allow(
        [{
          id: '1',
          permissions: ['user:posts:read'],
          check: {
            'request.user.role': 'admin'
          }
        }],
        {
          request: {
            user: {
              role: 'admin'
            }
          }
        },
        'user:posts:read'
      )
    })

    it('supports boolean conditions', () => {
      allow(
        [{
          id: '1',
          permissions: ['user:posts:update'],
          check: {
            'user.active': true
          }
        }],
        {
          user: { active: true }
        },
        'user:posts:update'
      )
    })

    it('supports numeric conditions', () => {
      allow(
        [{
          id: '1',
          permissions: ['user:accounts:read'],
          check: {
            'user.age': 25
          }
        }],
        {
          user: { age: 25 }
        },
        'user:accounts:read'
      )
    })

    it('supports null conditions', () => {
      allow(
        [{
          id: '1',
          permissions: ['user:users:update'],
          check: {
            'user.deletedAt': null
          }
        }],
        {
          user: { deletedAt: null }
        },
        'user:users:update'
      )
    })
  })


  // ─────────────────────────────────────────────
  // $expr / ownership
  // ─────────────────────────────────────────────

  describe('$expr', () => {
    it('allows resource owner', () => {
      allow(
        [{
          id: '1',
          permissions: ['user:posts:update'],
          check: {
            $expr: {
              $eq: [
                '$user.id',
                '$post.authorId'
              ]
            }
          }
        }],
        {
          user: { id: 10 },
          post: { authorId: 10 }
        },
        'user:posts:update'
      )
    })

    it('denies non-owner', () => {
      deny(
        [{
          id: '1',
          permissions: ['user:posts:update'],
          check: {
            $expr: {
              $eq: [
                '$user.id',
                '$post.authorId'
              ]
            }
          }
        }],
        {
          user: { id: 10 },
          post: { authorId: 20 }
        },
        'user:posts:update'
      )
    })

    it('uses strict equality for IDs', () => {
      deny(
        [{
          id: '1',
          permissions: ['user:posts:update'],
          check: {
            $expr: {
              $eq: [
                '$user.id',
                '$post.authorId'
              ]
            }
          }
        }],
        {
          user: { id: 10 },
          post: { authorId: '10' }
        },
        'user:posts:update'
      )
    })

    it('supports multiple expression conditions', () => {
      allow(
        [{
          id: '1',
          permissions: ['user:posts:update'],
          check: {
            $and: [
              {
                $expr: {
                  $eq: [
                    '$user.id',
                    '$post.authorId'
                  ]
                }
              },
              {
                'user.active': true
              }
            ]
          }
        }],
        {
          user: {
            id: 10,
            active: true
          },
          post: {
            authorId: 10
          }
        },
        'user:posts:update'
      )
    })

    it('denies when one combined condition fails', () => {
      deny(
        [{
          id: '1',
          permissions: ['user:posts:update'],
          check: {
            $and: [
              {
                $expr: {
                  $eq: [
                    '$user.id',
                    '$post.authorId'
                  ]
                }
              },
              {
                'user.active': true
              }
            ]
          }
        }],
        {
          user: {
            id: 10,
            active: false
          },
          post: {
            authorId: 10
          }
        },
        'user:posts:update'
      )
    })
  })


  // ─────────────────────────────────────────────
  // Real-world authorization
  // ─────────────────────────────────────────────

  describe('real-world authorization', () => {
    const rules = [
      {
        id: 'admin',
        name: 'Admins',
        permissions: ['admin:*:*']
      },
      {
        id: 'owner',
        name: 'Post owners',
        permissions: [
          'user:posts:update',
          'user:posts:remove'
        ],
        check: {
          $expr: {
            $eq: [
              '$user.id',
              '$post.authorId'
            ]
          }
        }
      },
      {
        id: 'published',
        name: 'Published posts',
        permissions: ['*:posts:read'],
        check: {
          'post.published': true
        }
      }
    ]

    it('admin can perform any admin permission', () => {
      allow(rules, {}, 'admin:users:create')
      allow(rules, {}, 'admin:users:update')
      allow(rules, {}, 'admin:users:delete')
      allow(rules, {}, 'admin:posts:update')
    })

    it('post owner can update own post', () => {
      allow(
        rules,
        {
          user: { id: 10 },
          post: { authorId: 10 }
        },
        'user:posts:update'
      )
    })

    it('post owner can remove own post', () => {
      allow(
        rules,
        {
          user: { id: 10 },
          post: { authorId: 10 }
        },
        'user:posts:remove'
      )
    })

    it('post owner cannot update another users post', () => {
      deny(
        rules,
        {
          user: { id: 10 },
          post: { authorId: 20 }
        },
        'user:posts:update'
      )
    })

    it('post owner cannot remove another users post', () => {
      deny(
        rules,
        {
          user: { id: 10 },
          post: { authorId: 20 }
        },
        'user:posts:remove'
      )
    })

    it('any role can read published post', () => {
      allow(
        rules,
        {
          post: { published: true }
        },
        'user:posts:read'
      )

      allow(
        rules,
        {
          post: { published: true }
        },
        'guest:posts:read'
      )
    })

    it('cannot read unpublished post through published rule', () => {
      deny(
        rules,
        {
          post: { published: false }
        },
        'user:posts:read'
      )
    })
  })


  // ─────────────────────────────────────────────
  // Request data validation
  // ─────────────────────────────────────────────

  describe('request data validation', () => {
    it('requires email on create', () => {
      const rules = [{
        id: '1',
        permissions: ['user:users:create'],
        check: {
          'data.email': {
            $exists: true
          }
        }
      }]

      allow(
        rules,
        { data: { email: 'a@example.com' } },
        'user:users:create'
      )

      deny(
        rules,
        { data: {} },
        'user:users:create'
      )
    })

    it('requires multiple fields', () => {
      const rules = [{
        id: '1',
        permissions: ['user:users:create'],
        check: {
          $and: [
            { 'data.email': { $exists: true } },
            { 'data.name': { $exists: true } }
          ]
        }
      }]

      allow(
        rules,
        {
          data: {
            email: 'a@example.com',
            name: 'Alice'
          }
        },
        'user:users:create'
      )

      deny(
        rules,
        {
          data: {
            email: 'a@example.com'
          }
        },
        'user:users:create'
      )
    })

    it('protects password during normal update', () => {
      const rules = [{
        id: '1',
        permissions: ['user:users:update'],
        check: {
          'data.password': {
            $exists: false
          }
        }
      }]

      allow(
        rules,
        { data: { name: 'Alice' } },
        'user:users:update'
      )

      deny(
        rules,
        {
          data: {
            name: 'Alice',
            password: 'secret'
          }
        },
        'user:users:update'
      )
    })

    it('allows password through a separate permission', () => {
      const rules = [
        {
          id: 'normal',
          permissions: ['user:users:update'],
          check: {
            'data.password': {
              $exists: false
            }
          }
        },
        {
          id: 'password',
          permissions: ['user:users:password'],
          check: {
            'data.password': {
              $exists: true
            }
          }
        }
      ]

      deny(
        rules,
        {
          data: {
            password: 'secret'
          }
        },
        'user:users:update'
      )

      allow(
        rules,
        {
          data: {
            password: 'secret'
          }
        },
        'user:users:password'
      )
    })

    it('protects multiple fields', () => {
      const rules = [{
        id: '1',
        permissions: ['user:users:update'],
        check: {
          $and: [
            { 'data.password': { $exists: false } },
            { 'data.role': { $exists: false } },
            { 'data.isAdmin': { $exists: false } }
          ]
        }
      }]

      allow(
        rules,
        { data: { name: 'Alice' } },
        'user:users:update'
      )

      deny(
        rules,
        { data: { role: 'admin' } },
        'user:users:update'
      )

      deny(
        rules,
        { data: { isAdmin: true } },
        'user:users:update'
      )
    })
  })


  // ─────────────────────────────────────────────
  // Missing / null / falsy context
  // ─────────────────────────────────────────────

  describe('context edge cases', () => {
    it('denies when required user context is missing', () => {
      deny(
        [{
          id: '1',
          permissions: ['user:posts:update'],
          check: {
            'user.role': 'owner'
          }
        }],
        {},
        'user:posts:update'
      )
    })

    it('denies when nested resource is missing', () => {
      deny(
        [{
          id: '1',
          permissions: ['user:posts:update'],
          check: {
            'post.authorId': 10
          }
        }],
        {
          user: { id: 10 }
        },
        'user:posts:update'
      )
    })

    it('handles null context values', () => {
      deny(
        [{
          id: '1',
          permissions: ['user:posts:update'],
          check: {
            'post.authorId': 10
          }
        }],
        {
          post: null
        },
        'user:posts:update'
      )
    })

    it('does not treat false as true', () => {
      deny(
        [{
          id: '1',
          permissions: ['user:posts:update'],
          check: {
            'user.active': true
          }
        }],
        {
          user: { active: false }
        },
        'user:posts:update'
      )
    })

    it('does not treat zero as a different numeric value', () => {
      allow(
        [{
          id: '1',
          permissions: ['user:posts:update'],
          check: {
            'user.id': 0
          }
        }],
        {
          user: { id: 0 }
        },
        'user:posts:update'
      )
    })
  })


  // ─────────────────────────────────────────────
  // ACL enabled / disabled
  // ─────────────────────────────────────────────

  describe('enabled', () => {
    it('denies by policy when enabled and unmatched', () => {
      const instance = createACL({
        enabled: true,
        rules: []
      })

      expect(
        instance.can({}, 'user:posts:read')
      ).toBe(false)
    })

    it('allows without evaluating rules when disabled', () => {
      const instance = createACL({
        enabled: false,
        rules: []
      })

      expect(
        instance.can({}, 'user:posts:read')
      ).toBe(true)
    })

    it('allows when disabled even with no matching permission', () => {
      const instance = createACL({
        enabled: false,
        rules: [
          {
            id: '1',
            permissions: ['admin:users:delete']
          }
        ]
      })

      expect(
        instance.can({}, 'user:posts:read')
      ).toBe(true)
    })
  })


  // ─────────────────────────────────────────────
  // Permission input edge cases
  // ─────────────────────────────────────────────

  describe('permission input', () => {
    const rules = [{
      id: '1',
      permissions: ['user:posts:read']
    }]

    it('denies undefined permission', () => {
      deny(rules, {}, undefined)
    })

    it('denies null permission', () => {
      deny(rules, {}, null)
    })

    it('denies empty permission', () => {
      deny(rules, {}, '')
    })

    it('denies permission with too few segments', () => {
      deny(rules, {}, 'user:posts')
    })

    it('denies permission with too many segments', () => {
      deny(rules, {}, 'user:posts:read:extra')
    })

    it('denies empty segments', () => {
      deny(rules, {}, ':posts:read')
      deny(rules, {}, 'user::read')
      deny(rules, {}, 'user:posts:')
    })
  })


  // ─────────────────────────────────────────────
  // Policy validation
  // ─────────────────────────────────────────────

  describe('policy validation', () => {
    it('requires policy object', () => {
      expect(() => createACL(null)).toThrow()
    })

    it('requires enabled boolean', () => {
      expect(() =>
        createACL({
          enabled: 'true',
          rules: []
        })
      ).toThrow()
    })

    it('requires rules array', () => {
      expect(() =>
        createACL({
          enabled: true,
          rules: {}
        })
      ).toThrow()
    })

    it('requires rule id', () => {
      expect(() =>
        createACL({
          enabled: true,
          rules: [
            {
              permissions: ['user:posts:read']
            }
          ]
        })
      ).toThrow()
    })

    it('requires non-empty permissions', () => {
      expect(() =>
        createACL({
          enabled: true,
          rules: [
            {
              id: '1',
              permissions: []
            }
          ]
        })
      ).toThrow()
    })

    it('requires permissions to be an array', () => {
      expect(() =>
        createACL({
          enabled: true,
          rules: [
            {
              id: '1',
              permissions: 'user:posts:read'
            }
          ]
        })
      ).toThrow()
    })

    it('rejects invalid permission patterns', () => {
      expect(() =>
        createACL({
          enabled: true,
          rules: [
            {
              id: '1',
              permissions: ['user:posts']
            }
          ]
        })
      ).toThrow()
    })

    it('allows optional name', () => {
      expect(() =>
        createACL({
          enabled: true,
          rules: [
            {
              id: '1',
              name: 'Read posts',
              permissions: ['*:posts:read']
            }
          ]
        })
      ).not.toThrow()
    })

    it('rejects non-string name', () => {
      expect(() =>
        createACL({
          enabled: true,
          rules: [
            {
              id: '1',
              name: 123,
              permissions: ['*:posts:read']
            }
          ]
        })
      ).toThrow()
    })

    it('rejects non-object check', () => {
      expect(() =>
        createACL({
          enabled: true,
          rules: [
            {
              id: '1',
              permissions: ['*:posts:read'],
              check: 'invalid'
            }
          ]
        })
      ).toThrow()
    })

    it('rejects null check', () => {
      expect(() =>
        createACL({
          enabled: true,
          rules: [
            {
              id: '1',
              permissions: ['*:posts:read'],
              check: null
            }
          ]
        })
      ).toThrow()
    })

    it('rejects non-object rule', () => {
      expect(() =>
        createACL({
          enabled: true,
          rules: ['invalid']
        })
      ).toThrow()
    })

    it('rejects null rule', () => {
      expect(() =>
        createACL({
          enabled: true,
          rules: [null]
        })
      ).toThrow()
    })
  })


  // ─────────────────────────────────────────────
  // Security / fail-closed behavior
  // ─────────────────────────────────────────────

  describe('security', () => {
    it('does not allow a user to change the permission being checked through context', () => {
      const rules = [{
        id: '1',
        permissions: ['admin:users:delete'],
        check: {
          'user.role': 'admin'
        }
      }]

      deny(
        rules,
        {
          user: {
            role: 'user',
            permission: 'admin:users:delete'
          }
        },
        'user:users:delete'
      )
    })

    it('does not authorize a different resource by context alone', () => {
      deny(
        [{
          id: '1',
          permissions: ['user:posts:update'],
          check: {
            $expr: {
              $eq: [
                '$user.id',
                '$post.authorId'
              ]
            }
          }
        }],
        {
          user: { id: 10 },
          post: { authorId: 20 }
        },
        'user:posts:update'
      )
    })

    it('denies unknown permission patterns rather than guessing', () => {
      deny(
        [{
          id: '1',
          permissions: ['user:posts:read']
        }],
        {},
        'user:posts:delete'
      )
    })
  })


  // ─────────────────────────────────────────────
  // Rule metadata
  // ─────────────────────────────────────────────

  describe('rule metadata', () => {
    it('name does not affect authorization', () => {
      allow(
        [{
          id: '1',
          name: 'Anything',
          permissions: ['user:posts:read']
        }],
        {},
        'user:posts:read'
      )
    })

    it('changing rule name does not change authorization', () => {
      const first = createACL({
        enabled: true,
        rules: [{
          id: '1',
          name: 'First',
          permissions: ['user:posts:read']
        }]
      })

      const second = createACL({
        enabled: true,
        rules: [{
          id: '1',
          name: 'Completely Different',
          permissions: ['user:posts:read']
        }]
      })

      expect(first.can({}, 'user:posts:read')).toBe(true)
      expect(second.can({}, 'user:posts:read')).toBe(true)
    })
  })
})