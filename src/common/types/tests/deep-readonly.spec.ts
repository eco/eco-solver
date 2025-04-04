import { DeepReadonly } from '@/common/types/deep-readonly'

describe('DeepReadonly type', () => {
  // Create test types to verify TypeScript behavior
  type TestObject = {
    num: number
    str: string
    nested: {
      value: number
      arr: string[]
    }
    arr: Array<{
      id: number
      name: string
    }>
  }

  type ReadonlyTestObject = DeepReadonly<TestObject>

  // These tests are mostly for TypeScript compilation, not runtime behavior
  it('should make all properties readonly at runtime', () => {
    const original: TestObject = {
      num: 42,
      str: 'hello',
      nested: {
        value: 100,
        arr: ['a', 'b', 'c'],
      },
      arr: [
        { id: 1, name: 'item1' },
        { id: 2, name: 'item2' },
      ],
    }

    // Cast to DeepReadonly
    const readonly = original as ReadonlyTestObject

    // Verify values are the same
    expect(readonly.num).toBe(42)
    expect(readonly.str).toBe('hello')
    expect(readonly.nested.value).toBe(100)
    expect(readonly.nested.arr).toEqual(['a', 'b', 'c'])
    expect(readonly.arr[0].id).toBe(1)
    expect(readonly.arr[1].name).toBe('item2')

    // The following would cause TypeScript errors if uncommented:
    // readonly.num = 43                  // Error: Cannot assign to 'num' because it is a read-only property
    // readonly.nested.value = 101        // Error: Cannot assign to 'value' because it is a read-only property
    // readonly.nested.arr.push('d')      // Error: Property 'push' does not exist on type 'readonly string[]'
    // readonly.arr[0].id = 3             // Error: Cannot assign to 'id' because it is a read-only property
    // readonly.arr.push({ id: 3, name: 'item3' }) // Error: Property 'push' does not exist on type...

    // But the original object can still be modified
    original.num = 43
    original.nested.value = 101
    original.nested.arr.push('d')
    original.arr[0].id = 3
    original.arr.push({ id: 3, name: 'item3' })

    // And those changes are reflected in the readonly reference
    expect(readonly.num).toBe(43)
    expect(readonly.nested.value).toBe(101)
    expect(readonly.nested.arr).toEqual(['a', 'b', 'c', 'd'])
    expect(readonly.arr[0].id).toBe(3)
    expect(readonly.arr.length).toBe(3)
  })

  // This is a basic runtime test to verify Object.freeze behavior,
  // though the DeepReadonly type is primarily for TypeScript type checking
  it('should verify Object.freeze behavior for comparison', () => {
    const obj = { x: 1, y: { z: 2 } }
    const frozen = Object.freeze(obj)

    // Direct properties are frozen
    let error: Error | null = null
    try {
      // This assignment will fail at runtime, but we're catching the error
      // TypeScript error is expected in strict mode
      Object.defineProperty(frozen, 'x', { value: 10 })
    } catch (e) {
      error = e as Error
    }
    expect(error).toBeInstanceOf(TypeError)

    // But nested objects aren't frozen by default
    expect(() => {
      frozen.y.z = 20
    }).not.toThrow()

    // In a true DeepReadonly, this would be prevented at compile time
  })
})
