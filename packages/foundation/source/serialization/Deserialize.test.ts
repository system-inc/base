// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-explicit-any */

import { JsonValueTransformer } from '@system-inc/base-common/json/value-transformer/JsonValueTransformer';
import { SerializableField } from './decorators/SerializableField';
import { SerializableObject } from './decorators/SerializableObject';
import { deserialize } from './Deserialize';

// Custom transformer for testing
class DateTransformer implements JsonValueTransformer<Date> {
    fromJson(v: unknown): Date {
        if (typeof v === 'string') {
            return new Date(v);
        }
        throw new Error('Invalid date format');
    }

    toJson(v: Date): string {
        return v.toISOString();
    }
}

// Test classes for deserialization
@SerializableObject()
class SimpleUser {
    @SerializableField(() => String)
    name: string;

    @SerializableField(() => Number)
    age: number;

    constructor(name: string = '', age: number = 0) {
        this.name = name;
        this.age = age;
    }
}

@SerializableObject()
class UserWithOptionalFields {
    @SerializableField(() => String)
    name: string;

    @SerializableField(() => String, { optional: true })
    email?: string;

    @SerializableField(() => String, { defaultValue: 'user' })
    role: string;

    constructor(name: string = '', email?: string, role: string = 'user') {
        this.name = name;
        this.email = email;
        this.role = role;
    }
}

@SerializableObject()
class UserWithCustomFieldNames {
    @SerializableField(() => String, { name: 'full_name' })
    name: string;

    @SerializableField(() => Number, { name: 'user_age' })
    age: number;

    constructor(name: string = '', age: number = 0) {
        this.name = name;
        this.age = age;
    }
}

@SerializableObject()
class Address {
    @SerializableField(() => String)
    street: string;

    @SerializableField(() => String)
    city: string;

    constructor(street: string = '', city: string = '') {
        this.street = street;
        this.city = city;
    }
}

@SerializableObject()
class UserWithAddress {
    @SerializableField(() => String)
    name: string;

    @SerializableField(() => Address)
    address: Address;

    constructor(name: string = '', address?: Address) {
        this.name = name;
        this.address = address || new Address();
    }
}

@SerializableObject()
class UserWithTransformer {
    @SerializableField(() => String)
    name: string;

    @SerializableField(() => Date, { transformer: DateTransformer })
    birthDate: Date;

    constructor(name: string = '', birthDate?: Date) {
        this.name = name;
        this.birthDate = birthDate || new Date();
    }
}

describe('deserialize', () => {
    describe('basic deserialization', () => {
        it('should deserialize a simple object with required fields', () => {
            const raw = {
                name: 'John Doe',
                age: 30,
            };
            const result = deserialize(raw, SimpleUser, { strict: true });

            expect(result).toBeInstanceOf(SimpleUser);
            expect(result.name).toBe('John Doe');
            expect(result.age).toBe(30);
        });

        it('should deserialize an object with optional fields when provided', () => {
            const raw = {
                name: 'John Doe',
                email: 'john@example.com',
                role: 'admin',
            };
            const result = deserialize(raw, UserWithOptionalFields, {
                strict: true,
            });

            expect(result).toBeInstanceOf(UserWithOptionalFields);
            expect(result.name).toBe('John Doe');
            expect(result.email).toBe('john@example.com');
            expect(result.role).toBe('admin');
        });

        it('should deserialize an object with optional fields when not provided', () => {
            const raw = {
                name: 'John Doe',
            };
            const result = deserialize(raw, UserWithOptionalFields, {
                strict: true,
            });

            expect(result).toBeInstanceOf(UserWithOptionalFields);
            expect(result.name).toBe('John Doe');
            expect(result.email).toBeUndefined();
            expect(result.role).toBe('user'); // default value
        });

        it('should use default values when fields are not provided', () => {
            const raw = {
                name: 'John Doe',
            };
            const result = deserialize(raw, UserWithOptionalFields, {
                strict: true,
            });

            expect(result.role).toBe('user');
        });

        it('should use custom field names when specified', () => {
            const raw = {
                full_name: 'John Doe',
                user_age: 30,
            };
            const result = deserialize(raw, UserWithCustomFieldNames, {
                strict: true,
            });

            expect(result).toBeInstanceOf(UserWithCustomFieldNames);
            expect(result.name).toBe('John Doe');
            expect(result.age).toBe(30);
        });

        it('applies defaults to the PROPERTY name for renamed absent fields', () => {
            // Audit finding 12: the default used to land on a junk
            // wire-named property, leaving the real property unset.
            @SerializableObject()
            class RenamedDefault {
                @SerializableField(() => String, {
                    name: 'display_name',
                    defaultValue: 'anon',
                })
                displayName: string;

                constructor() {
                    this.displayName = '';
                }
            }

            const result = deserialize({}, RenamedDefault, { strict: true });
            expect(result.displayName).toBe('anon');
            expect(
                (result as unknown as Record<string, unknown>).display_name,
            ).toBeUndefined();
        });

        it('inherited fields deserialize and enforce required-ness', () => {
            // Audit finding 6: metadata did not walk the prototype chain,
            // so subclass instances silently lost every inherited field.
            @SerializableObject()
            class BaseDto {
                @SerializableField(() => String)
                id: string;

                constructor() {
                    this.id = '';
                }
            }

            @SerializableObject()
            class UserDto extends BaseDto {
                @SerializableField(() => String)
                email: string;

                constructor() {
                    super();
                    this.email = '';
                }
            }

            const result = deserialize({ id: 'u1', email: 'a@b.c' }, UserDto, {
                strict: true,
            });
            expect(result.id).toBe('u1');
            expect(result.email).toBe('a@b.c');

            // A missing inherited required field must throw, not vanish.
            expect(() =>
                deserialize({ email: 'a@b.c' }, UserDto, { strict: true }),
            ).toThrow(/id/);
        });
    });

    describe('nested object deserialization', () => {
        // Test class for contact information
        @SerializableObject()
        class ContactInfo {
            @SerializableField(() => String)
            email: string;

            @SerializableField(() => String)
            phone: string;

            constructor(email: string = '', phone: string = '') {
                this.email = email;
                this.phone = phone;
            }
        }

        // Test class for company information
        @SerializableObject()
        class Company {
            @SerializableField(() => String)
            name: string;

            @SerializableField(() => Address)
            headquarters: Address;

            @SerializableField(() => ContactInfo)
            contact: ContactInfo;

            constructor(
                name: string = '',
                headquarters?: Address,
                contact?: ContactInfo,
            ) {
                this.name = name;
                this.headquarters = headquarters || new Address();
                this.contact = contact || new ContactInfo();
            }
        }

        // Test class for employee with multi-level nesting
        @SerializableObject()
        class Employee {
            @SerializableField(() => String)
            name: string;

            @SerializableField(() => Address)
            homeAddress: Address;

            @SerializableField(() => Company)
            employer: Company;

            @SerializableField(() => ContactInfo)
            personalContact: ContactInfo;

            constructor(
                name: string = '',
                homeAddress?: Address,
                employer?: Company,
                personalContact?: ContactInfo,
            ) {
                this.name = name;
                this.homeAddress = homeAddress || new Address();
                this.employer = employer || new Company();
                this.personalContact = personalContact || new ContactInfo();
            }
        }

        // Test class with optional nested objects
        @SerializableObject()
        class UserProfile {
            @SerializableField(() => String)
            username: string;

            @SerializableField(() => Address, { optional: true })
            billingAddress?: Address;

            @SerializableField(() => Address, { optional: true })
            shippingAddress?: Address;

            @SerializableField(() => ContactInfo, { optional: true })
            emergencyContact?: ContactInfo;

            constructor(
                username: string = '',
                billingAddress?: Address,
                shippingAddress?: Address,
                emergencyContact?: ContactInfo,
            ) {
                this.username = username;
                this.billingAddress = billingAddress;
                this.shippingAddress = shippingAddress;
                this.emergencyContact = emergencyContact;
            }
        }

        // Test class with nested objects having custom field names
        @SerializableObject()
        class CustomerRecord {
            @SerializableField(() => String, { name: 'customer_name' })
            name: string;

            @SerializableField(() => Address, { name: 'primary_address' })
            address: Address;

            @SerializableField(() => ContactInfo, { name: 'contact_details' })
            contact: ContactInfo;

            constructor(
                name: string = '',
                address?: Address,
                contact?: ContactInfo,
            ) {
                this.name = name;
                this.address = address || new Address();
                this.contact = contact || new ContactInfo();
            }
        }

        // Test class with mixed nested structures
        @SerializableObject()
        class Organization {
            @SerializableField(() => String)
            name: string;

            @SerializableField(() => [Address])
            locations: Address[];

            @SerializableField(() => Employee, { optional: true })
            ceo?: Employee;

            @SerializableField(() => [String])
            departments: string[];

            @SerializableField(() => ContactInfo)
            mainContact: ContactInfo;

            constructor(
                name: string = '',
                locations: Address[] = [],
                mainContact?: ContactInfo,
                departments: string[] = [],
                ceo?: Employee,
            ) {
                this.name = name;
                this.locations = locations;
                this.mainContact = mainContact || new ContactInfo();
                this.departments = departments;
                this.ceo = ceo;
            }
        }

        it('should deserialize nested objects', () => {
            const raw = {
                name: 'John Doe',
                address: {
                    street: '123 Main St',
                    city: 'New York',
                },
            };
            const result = deserialize(raw, UserWithAddress, { strict: true });

            expect(result).toBeInstanceOf(UserWithAddress);
            expect(result.name).toBe('John Doe');
            expect(result.address).toBeInstanceOf(Address);
            expect(result.address.street).toBe('123 Main St');
            expect(result.address.city).toBe('New York');
        });

        it('should deserialize objects with multiple nested objects', () => {
            const raw = {
                username: 'johndoe',
                billingAddress: {
                    street: '123 Elm St',
                    city: 'Springfield',
                },
                emergencyContact: {
                    email: 'john@example.com',
                    phone: '555-1234',
                },
                // shippingAddress not provided (optional)
            };
            const result = deserialize(raw, UserProfile, { strict: true });

            expect(result).toBeInstanceOf(UserProfile);
            expect(result.username).toBe('johndoe');
            expect(result.billingAddress).toBeInstanceOf(Address);
            expect(result.billingAddress!.street).toBe('123 Elm St');
            expect(result.billingAddress!.city).toBe('Springfield');
            expect(result.emergencyContact).toBeInstanceOf(ContactInfo);
            expect(result.emergencyContact!.email).toBe('john@example.com');
            expect(result.emergencyContact!.phone).toBe('555-1234');
            expect(result.shippingAddress).toBeUndefined();
        });

        it('should deserialize multi-level nested objects', () => {
            const raw = {
                name: 'Jane Smith',
                homeAddress: {
                    street: '789 Residential St',
                    city: 'Home Town',
                },
                employer: {
                    name: 'Tech Corp',
                    headquarters: {
                        street: '456 Corporate Blvd',
                        city: 'Business City',
                    },
                    contact: {
                        email: 'info@company.com',
                        phone: '555-9999',
                    },
                },
                personalContact: {
                    email: 'employee@personal.com',
                    phone: '555-5555',
                },
            };
            const result = deserialize(raw, Employee, { strict: true });

            expect(result).toBeInstanceOf(Employee);
            expect(result.name).toBe('Jane Smith');
            expect(result.homeAddress).toBeInstanceOf(Address);
            expect(result.homeAddress.street).toBe('789 Residential St');
            expect(result.homeAddress.city).toBe('Home Town');
            expect(result.employer).toBeInstanceOf(Company);
            expect(result.employer.name).toBe('Tech Corp');
            expect(result.employer.headquarters).toBeInstanceOf(Address);
            expect(result.employer.headquarters.street).toBe(
                '456 Corporate Blvd',
            );
            expect(result.employer.headquarters.city).toBe('Business City');
            expect(result.employer.contact).toBeInstanceOf(ContactInfo);
            expect(result.employer.contact.email).toBe('info@company.com');
            expect(result.employer.contact.phone).toBe('555-9999');
            expect(result.personalContact).toBeInstanceOf(ContactInfo);
            expect(result.personalContact.email).toBe('employee@personal.com');
            expect(result.personalContact.phone).toBe('555-5555');
        });

        it('should deserialize optional nested objects when provided', () => {
            const raw = {
                username: 'completuser',
                billingAddress: {
                    street: '123 Billing St',
                    city: 'Billing City',
                },
                shippingAddress: {
                    street: '456 Shipping Ave',
                    city: 'Shipping Town',
                },
                emergencyContact: {
                    email: 'emergency@contact.com',
                    phone: '911-911-911',
                },
            };
            const result = deserialize(raw, UserProfile, { strict: true });

            expect(result).toBeInstanceOf(UserProfile);
            expect(result.username).toBe('completuser');
            expect(result.billingAddress).toBeInstanceOf(Address);
            expect(result.billingAddress!.street).toBe('123 Billing St');
            expect(result.billingAddress!.city).toBe('Billing City');
            expect(result.shippingAddress).toBeInstanceOf(Address);
            expect(result.shippingAddress!.street).toBe('456 Shipping Ave');
            expect(result.shippingAddress!.city).toBe('Shipping Town');
            expect(result.emergencyContact).toBeInstanceOf(ContactInfo);
            expect(result.emergencyContact!.email).toBe(
                'emergency@contact.com',
            );
            expect(result.emergencyContact!.phone).toBe('911-911-911');
        });

        it('should deserialize optional nested objects when not provided', () => {
            const raw = {
                username: 'minimaluser',
                // All optional nested objects not provided
            };
            const result = deserialize(raw, UserProfile, { strict: true });

            expect(result).toBeInstanceOf(UserProfile);
            expect(result.username).toBe('minimaluser');
            expect(result.billingAddress).toBeUndefined();
            expect(result.shippingAddress).toBeUndefined();
            expect(result.emergencyContact).toBeUndefined();
        });

        it('should deserialize nested objects with custom field names', () => {
            const raw = {
                customer_name: 'John Customer',
                primary_address: {
                    street: '789 Customer St',
                    city: 'Customer City',
                },
                contact_details: {
                    email: 'customer@example.com',
                    phone: '555-CUST',
                },
            };
            const result = deserialize(raw, CustomerRecord, { strict: true });

            expect(result).toBeInstanceOf(CustomerRecord);
            expect(result.name).toBe('John Customer');
            expect(result.address).toBeInstanceOf(Address);
            expect(result.address.street).toBe('789 Customer St');
            expect(result.address.city).toBe('Customer City');
            expect(result.contact).toBeInstanceOf(ContactInfo);
            expect(result.contact.email).toBe('customer@example.com');
            expect(result.contact.phone).toBe('555-CUST');
        });

        it('should deserialize complex mixed nested structures', () => {
            const raw = {
                name: 'Global Corp',
                locations: [
                    { street: '100 Main Office', city: 'HQ City' },
                    { street: '200 Branch Office', city: 'Branch City' },
                ],
                departments: ['Engineering', 'Sales', 'Marketing'],
                mainContact: {
                    email: 'org@example.com',
                    phone: '555-ORG1',
                },
                // ceo is optional and not provided
            };
            const result = deserialize(raw, Organization, { strict: true });

            expect(result).toBeInstanceOf(Organization);
            expect(result.name).toBe('Global Corp');
            expect(result.locations).toHaveLength(2);
            expect(result.locations[0]).toBeInstanceOf(Address);
            expect(result.locations[0].street).toBe('100 Main Office');
            expect(result.locations[0].city).toBe('HQ City');
            expect(result.locations[1]).toBeInstanceOf(Address);
            expect(result.locations[1].street).toBe('200 Branch Office');
            expect(result.locations[1].city).toBe('Branch City');
            expect(result.departments).toEqual([
                'Engineering',
                'Sales',
                'Marketing',
            ]);
            expect(result.mainContact).toBeInstanceOf(ContactInfo);
            expect(result.mainContact.email).toBe('org@example.com');
            expect(result.mainContact.phone).toBe('555-ORG1');
            expect(result.ceo).toBeUndefined();
        });

        it('should deserialize nested objects with null values', () => {
            const raw = {
                username: 'nulluser',
                billingAddress: null,
                emergencyContact: null,
                // shippingAddress is undefined (omitted)
            };
            const result = deserialize(raw, UserProfile, { strict: true });

            expect(result).toBeInstanceOf(UserProfile);
            expect(result.username).toBe('nulluser');
            expect(result.billingAddress).toBeNull();
            expect(result.emergencyContact).toBeNull();
            expect(result.shippingAddress).toBeUndefined();
        });

        it('should deserialize deeply nested objects in arrays', () => {
            const raw = [
                {
                    name: 'Company One',
                    headquarters: {
                        street: '100 First St',
                        city: 'First City',
                    },
                    contact: {
                        email: 'contact1@example.com',
                        phone: '555-0001',
                    },
                },
                {
                    name: 'Company Two',
                    headquarters: {
                        street: '200 Second St',
                        city: 'Second City',
                    },
                    contact: {
                        email: 'contact2@example.com',
                        phone: '555-0002',
                    },
                },
            ];
            const result = deserialize(raw, Company, {
                strict: true,
            }) as unknown as Company[];

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(2);
            expect(result[0]).toBeInstanceOf(Company);
            expect(result[0].name).toBe('Company One');
            expect(result[0].headquarters).toBeInstanceOf(Address);
            expect(result[0].headquarters.street).toBe('100 First St');
            expect(result[0].headquarters.city).toBe('First City');
            expect(result[0].contact).toBeInstanceOf(ContactInfo);
            expect(result[0].contact.email).toBe('contact1@example.com');
            expect(result[0].contact.phone).toBe('555-0001');
            expect(result[1]).toBeInstanceOf(Company);
            expect(result[1].name).toBe('Company Two');
            expect(result[1].headquarters).toBeInstanceOf(Address);
            expect(result[1].headquarters.street).toBe('200 Second St');
            expect(result[1].headquarters.city).toBe('Second City');
            expect(result[1].contact).toBeInstanceOf(ContactInfo);
            expect(result[1].contact.email).toBe('contact2@example.com');
            expect(result[1].contact.phone).toBe('555-0002');
        });

        it('should handle missing required nested objects', () => {
            const raw = {
                name: 'Jane Smith',
                homeAddress: {
                    street: '789 Residential St',
                    city: 'Home Town',
                },
                // Missing required employer and personalContact
            };

            expect(() => deserialize(raw, Employee)).toThrow(
                "Missing required field 'employer' in raw data for Employee",
            );
        });
    });

    describe('array deserialization', () => {
        // Test class with arrays of primitive types
        @SerializableObject()
        class UserWithArrays {
            @SerializableField(() => String)
            name: string;

            @SerializableField(() => [String])
            hobbies: string[];

            @SerializableField(() => [Number])
            scores: number[];

            @SerializableField(() => [Boolean])
            flags: boolean[];

            constructor(
                name: string = '',
                hobbies: string[] = [],
                scores: number[] = [],
                flags: boolean[] = [],
            ) {
                this.name = name;
                this.hobbies = hobbies;
                this.scores = scores;
                this.flags = flags;
            }
        }

        // Test class with arrays of complex objects
        @SerializableObject()
        class UserWithComplexArrays {
            @SerializableField(() => String)
            name: string;

            @SerializableField(() => [Address])
            addresses: Address[];

            @SerializableField(() => [SimpleUser])
            friends: SimpleUser[];

            constructor(
                name: string = '',
                addresses: Address[] = [],
                friends: SimpleUser[] = [],
            ) {
                this.name = name;
                this.addresses = addresses;
                this.friends = friends;
            }
        }

        // Test class with nested arrays
        @SerializableObject()
        class UserWithNestedArrays {
            @SerializableField(() => String)
            name: string;

            @SerializableField(() => [[Number]])
            skillMatrix: number[][];

            @SerializableField(() => [[String]])
            groupedHobbies: string[][];

            constructor(
                name: string = '',
                skillMatrix: number[][] = [],
                groupedHobbies: string[][] = [],
            ) {
                this.name = name;
                this.skillMatrix = skillMatrix;
                this.groupedHobbies = groupedHobbies;
            }
        }

        // Test class with mixed arrays and optional fields
        @SerializableObject()
        class UserWithMixedArrays {
            @SerializableField(() => String)
            name: string;

            @SerializableField(() => [String], { optional: true })
            optionalTags?: string[];

            @SerializableField(() => [Number], { defaultValue: [0, 1, 2] })
            defaultNumbers: number[];

            @SerializableField(() => [String], { name: 'custom_array' })
            customArray: string[];

            constructor(
                name: string = '',
                customArray: string[] = [],
                optionalTags?: string[],
                defaultNumbers: number[] = [0, 1, 2],
            ) {
                this.name = name;
                this.customArray = customArray;
                this.optionalTags = optionalTags;
                this.defaultNumbers = defaultNumbers;
            }
        }

        it('should deserialize an array of objects', () => {
            const raw = [
                { name: 'John Doe', age: 30 },
                { name: 'Jane Smith', age: 25 },
            ];
            const result = deserialize(raw, SimpleUser, {
                strict: true,
            }) as unknown as SimpleUser[];

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(2);
            expect(result[0]).toBeInstanceOf(SimpleUser);
            expect(result[0].name).toBe('John Doe');
            expect(result[0].age).toBe(30);
            expect(result[1]).toBeInstanceOf(SimpleUser);
            expect(result[1].name).toBe('Jane Smith');
            expect(result[1].age).toBe(25);
        });

        it('should deserialize arrays of primitive types', () => {
            const raw = {
                name: 'John Doe',
                hobbies: ['reading', 'gaming', 'cooking'],
                scores: [95, 87, 92],
                flags: [true, false, true],
            };
            const result = deserialize(raw, UserWithArrays, { strict: true });

            expect(result).toBeInstanceOf(UserWithArrays);
            expect(result.name).toBe('John Doe');
            expect(result.hobbies).toEqual(['reading', 'gaming', 'cooking']);
            expect(result.scores).toEqual([95, 87, 92]);
            expect(result.flags).toEqual([true, false, true]);
        });

        it('should deserialize empty arrays', () => {
            const raw = {
                name: 'John Doe',
                hobbies: [],
                scores: [],
                flags: [],
            };
            const result = deserialize(raw, UserWithArrays, { strict: true });

            expect(result).toBeInstanceOf(UserWithArrays);
            expect(result.name).toBe('John Doe');
            expect(result.hobbies).toEqual([]);
            expect(result.scores).toEqual([]);
            expect(result.flags).toEqual([]);
        });

        it('should deserialize arrays of complex objects', () => {
            const raw = {
                name: 'John Doe',
                addresses: [
                    { street: '123 Main St', city: 'New York' },
                    { street: '456 Oak Ave', city: 'Los Angeles' },
                ],
                friends: [
                    { name: 'Alice', age: 28 },
                    { name: 'Bob', age: 32 },
                ],
            };
            const result = deserialize(raw, UserWithComplexArrays, {
                strict: true,
            });

            expect(result).toBeInstanceOf(UserWithComplexArrays);
            expect(result.name).toBe('John Doe');
            expect(result.addresses).toHaveLength(2);
            expect(result.addresses[0]).toBeInstanceOf(Address);
            expect(result.addresses[0].street).toBe('123 Main St');
            expect(result.addresses[0].city).toBe('New York');
            expect(result.addresses[1]).toBeInstanceOf(Address);
            expect(result.addresses[1].street).toBe('456 Oak Ave');
            expect(result.addresses[1].city).toBe('Los Angeles');
            expect(result.friends).toHaveLength(2);
            expect(result.friends[0]).toBeInstanceOf(SimpleUser);
            expect(result.friends[0].name).toBe('Alice');
            expect(result.friends[0].age).toBe(28);
            expect(result.friends[1]).toBeInstanceOf(SimpleUser);
            expect(result.friends[1].name).toBe('Bob');
            expect(result.friends[1].age).toBe(32);
        });

        it('should deserialize nested arrays (arrays of arrays)', () => {
            const raw = {
                name: 'John Doe',
                skillMatrix: [
                    [1, 2, 3],
                    [4, 5, 6],
                    [7, 8, 9],
                ],
                groupedHobbies: [
                    ['reading', 'writing'],
                    ['gaming', 'streaming'],
                    ['cooking', 'baking'],
                ],
            };
            const result = deserialize(raw, UserWithNestedArrays, {
                strict: true,
            });

            expect(result).toBeInstanceOf(UserWithNestedArrays);
            expect(result.name).toBe('John Doe');
            expect(result.skillMatrix).toEqual([
                [1, 2, 3],
                [4, 5, 6],
                [7, 8, 9],
            ]);
            expect(result.groupedHobbies).toEqual([
                ['reading', 'writing'],
                ['gaming', 'streaming'],
                ['cooking', 'baking'],
            ]);
        });

        it('should deserialize arrays with optional and default values', () => {
            const raw = {
                name: 'John Doe',
                custom_array: ['a', 'b', 'c'],
                // optionalTags and defaultNumbers not provided
            };
            const result = deserialize(raw, UserWithMixedArrays, {
                strict: true,
            });

            expect(result).toBeInstanceOf(UserWithMixedArrays);
            expect(result.name).toBe('John Doe');
            expect(result.customArray).toEqual(['a', 'b', 'c']);
            expect(result.optionalTags).toBeUndefined();
            expect(result.defaultNumbers).toEqual([0, 1, 2]); // default value
        });

        it('should deserialize arrays with provided optional values', () => {
            const raw = {
                name: 'John Doe',
                custom_array: ['a', 'b'],
                optionalTags: ['tag1', 'tag2'],
                defaultNumbers: [10, 20],
            };
            const result = deserialize(raw, UserWithMixedArrays, {
                strict: true,
            });

            expect(result).toBeInstanceOf(UserWithMixedArrays);
            expect(result.name).toBe('John Doe');
            expect(result.customArray).toEqual(['a', 'b']);
            expect(result.optionalTags).toEqual(['tag1', 'tag2']);
            expect(result.defaultNumbers).toEqual([10, 20]);
        });

        it('should deserialize arrays containing null values', () => {
            const raw = {
                name: 'John Doe',
                hobbies: ['valid', null],
                scores: [1, null, 3],
                flags: [true, null, false],
            } as any; // cast to any to allow null in arrays for testing
            const result = deserialize(raw, UserWithArrays, { strict: true });

            expect(result).toBeInstanceOf(UserWithArrays);
            expect(result.name).toBe('John Doe');
            expect(result.hobbies).toEqual(['valid', null]);
            expect(result.scores).toEqual([1, null, 3]);
            expect(result.flags).toEqual([true, null, false]);
        });

        it('should deserialize single-element arrays', () => {
            const raw = {
                name: 'John Doe',
                hobbies: ['single'],
                scores: [42],
                flags: [true],
            };
            const result = deserialize(raw, UserWithArrays, { strict: true });

            expect(result).toBeInstanceOf(UserWithArrays);
            expect(result.name).toBe('John Doe');
            expect(result.hobbies).toEqual(['single']);
            expect(result.scores).toEqual([42]);
            expect(result.flags).toEqual([true]);
        });

        it('should handle missing array fields based on field options', () => {
            const raw = {
                name: 'John Doe',
                custom_array: ['required'],
                // missing hobbies, scores, flags (all required), optionalTags (optional), defaultNumbers (has default)
            };

            expect(() => deserialize(raw, UserWithArrays)).toThrow(
                "Missing required field 'hobbies' in raw data for UserWithArrays",
            );
        });
    });

    describe('primitive value handling', () => {
        it('should return null and undefined as is', () => {
            expect((deserialize as any)(null, SimpleUser)).toBeNull();
            expect((deserialize as any)(undefined, SimpleUser)).toBeUndefined();
        });
    });

    describe('transformer support', () => {
        it('should use custom transformers when provided', () => {
            const raw = {
                name: 'John Doe',
                birthDate: '1990-06-15T12:00:00.000Z',
            };
            const result = deserialize(raw, UserWithTransformer, {
                strict: true,
            });

            expect(result).toBeInstanceOf(UserWithTransformer);
            expect(result.name).toBe('John Doe');
            expect(result.birthDate).toBeInstanceOf(Date);
            expect(result.birthDate.getUTCFullYear()).toBe(1990);
            expect(result.birthDate.getUTCMonth()).toBe(5); // June is month 5 (0-indexed)
        });

        it('should throw error when transformer receives invalid data', () => {
            const raw = {
                name: 'John Doe',
                birthDate: 123, // invalid format, not a string
            };

            expect(() => deserialize(raw, UserWithTransformer)).toThrow(
                'Invalid date format',
            );
        });
    });

    describe('TypeFunc support', () => {
        it('should work with TypeFunc instead of Constructor', () => {
            const raw = {
                name: 'John Doe',
                age: 30,
            };
            const result = deserialize(raw, () => SimpleUser, { strict: true });

            expect(result).toBeInstanceOf(SimpleUser);
            expect(result.name).toBe('John Doe');
            expect(result.age).toBe(30);
        });
    });

    describe('error handling', () => {
        it('should throw error for required fields that are missing', () => {
            const raw = {
                age: 30,
                // missing required 'name' field
            };

            expect(() => deserialize(raw, SimpleUser)).toThrow(
                "Missing required field 'name' in raw data for SimpleUser",
            );
        });

        it('should throw error for objects without @SerializableObject decorator in strict mode', () => {
            class UnmarkedClass {
                value = 'test';
            }
            const raw = { value: 'test' };

            expect(() =>
                deserialize(raw, UnmarkedClass, { strict: true }),
            ).toThrow('No @SerializableObject metadata for UnmarkedClass');
        });

        it('should return undefined for objects without @SerializableObject decorator in non-strict mode', () => {
            class UnmarkedClass {
                value = 'test';
            }
            const raw = { value: 'test' };

            const result = deserialize(raw, UnmarkedClass, { strict: false });
            expect(result).toBeUndefined();
        });

        it('should return undefined for objects without @SerializableObject decorator by default', () => {
            class UnmarkedClass {
                value = 'test';
            }
            const raw = { value: 'test' };

            const result = deserialize(raw, UnmarkedClass);
            expect(result).toBeUndefined();
        });

        it('should throw error when custom field name is missing', () => {
            const raw = {
                name: 'John Doe', // should be 'full_name'
                user_age: 30,
            };

            expect(() => deserialize(raw, UserWithCustomFieldNames)).toThrow(
                "Missing required field 'full_name' in raw data for UserWithCustomFieldNames",
            );
        });
    });

    describe('default value assignment', () => {
        it('should assign default value when field is missing', () => {
            const raw = {
                name: 'John Doe',
                // role missing, should use default value
            };

            const result = deserialize(raw, UserWithOptionalFields, {
                strict: true,
            });

            expect(result).toBeInstanceOf(UserWithOptionalFields);
            expect(result.name).toBe('John Doe');
            expect(result.role).toBe('user'); // should get default value
        });
    });

    describe('raw object passthrough', () => {
        @SerializableObject()
        class UserWithRawField {
            @SerializableField(() => String)
            name: string;

            @SerializableField()
            metadata: Record<string, unknown>;

            @SerializableField()
            settings: object;

            constructor(
                name: string = '',
                metadata: Record<string, unknown> = {},
                settings: object = {},
            ) {
                this.name = name;
                this.metadata = metadata;
                this.settings = settings;
            }
        }

        @SerializableObject()
        class UserWithOptionalRawField {
            @SerializableField(() => String)
            name: string;

            @SerializableField(undefined, { optional: true })
            optionalData?: any;

            @SerializableField(undefined, { defaultValue: { theme: 'light' } })
            defaultConfig: any;

            constructor(
                name: string = '',
                optionalData?: any,
                defaultConfig: any = { theme: 'light' },
            ) {
                this.name = name;
                this.optionalData = optionalData;
                this.defaultConfig = defaultConfig;
            }
        }

        @SerializableObject()
        class UserWithNestedRawFields {
            @SerializableField(() => String)
            name: string;

            @SerializableField()
            profile: {
                avatar: string;
                preferences: Record<string, unknown>;
                history: any[];
            };

            constructor(name: string = '', profile: any = {}) {
                this.name = name;
                this.profile = profile;
            }
        }

        it('should deserialize raw object fields without type transformation', () => {
            const raw = {
                name: 'John Doe',
                metadata: {
                    userId: 123,
                    tags: ['admin', 'premium'],
                    lastLogin: '2023-01-01T00:00:00Z',
                    preferences: {
                        theme: 'dark',
                        language: 'en',
                        notifications: true,
                    },
                },
                settings: {
                    autoSave: true,
                    maxFileSize: 5242880,
                    allowedFormats: ['jpg', 'png', 'pdf'],
                },
            };

            const result = deserialize(raw, UserWithRawField, { strict: true });

            expect(result).toBeInstanceOf(UserWithRawField);
            expect(result.name).toBe('John Doe');
            expect(result.metadata).toEqual({
                userId: 123,
                tags: ['admin', 'premium'],
                lastLogin: '2023-01-01T00:00:00Z',
                preferences: {
                    theme: 'dark',
                    language: 'en',
                    notifications: true,
                },
            });
            expect(result.settings).toEqual({
                autoSave: true,
                maxFileSize: 5242880,
                allowedFormats: ['jpg', 'png', 'pdf'],
            });
        });

        it('should deserialize complex nested objects without type constraints', () => {
            const raw = {
                name: 'Jane Smith',
                profile: {
                    avatar: 'https://example.com/avatar.jpg',
                    preferences: {
                        theme: 'dark',
                        language: 'en',
                        customFields: {
                            field1: 'value1',
                            field2: [1, 2, 3],
                            field3: { nested: true, count: 42 },
                        },
                    },
                    history: [
                        { action: 'login', timestamp: '2023-01-01T10:00:00Z' },
                        {
                            action: 'edit_profile',
                            timestamp: '2023-01-01T10:30:00Z',
                            data: { field: 'email' },
                        },
                        { action: 'logout', timestamp: '2023-01-01T11:00:00Z' },
                    ],
                },
            };

            const result = deserialize(raw, UserWithNestedRawFields, {
                strict: true,
            });

            expect(result).toBeInstanceOf(UserWithNestedRawFields);
            expect(result.name).toBe('Jane Smith');
            expect(result.profile).toEqual({
                avatar: 'https://example.com/avatar.jpg',
                preferences: {
                    theme: 'dark',
                    language: 'en',
                    customFields: {
                        field1: 'value1',
                        field2: [1, 2, 3],
                        field3: { nested: true, count: 42 },
                    },
                },
                history: [
                    { action: 'login', timestamp: '2023-01-01T10:00:00Z' },
                    {
                        action: 'edit_profile',
                        timestamp: '2023-01-01T10:30:00Z',
                        data: { field: 'email' },
                    },
                    { action: 'logout', timestamp: '2023-01-01T11:00:00Z' },
                ],
            });
        });

        it('should deserialize optional raw fields when provided', () => {
            const raw = {
                name: 'Alice',
                optionalData: {
                    customId: 'custom-123',
                    flags: [true, false, true],
                    dynamicContent: {
                        type: 'json',
                        content: { message: 'Hello World' },
                    },
                },
                defaultConfig: { theme: 'light' },
            };

            const result = deserialize(raw, UserWithOptionalRawField, {
                strict: true,
            });

            expect(result).toBeInstanceOf(UserWithOptionalRawField);
            expect(result.name).toBe('Alice');
            expect(result.optionalData).toEqual({
                customId: 'custom-123',
                flags: [true, false, true],
                dynamicContent: {
                    type: 'json',
                    content: { message: 'Hello World' },
                },
            });
            expect(result.defaultConfig).toEqual({ theme: 'light' });
        });

        it('should deserialize optional raw fields when not provided', () => {
            const raw = {
                name: 'Bob',
                // optionalData not provided, defaultConfig will use default value
            };

            const result = deserialize(raw, UserWithOptionalRawField, {
                strict: true,
            });

            expect(result).toBeInstanceOf(UserWithOptionalRawField);
            expect(result.name).toBe('Bob');
            expect(result.optionalData).toBeUndefined();
            expect(result.defaultConfig).toEqual({ theme: 'light' });
        });

        it('should use default values for raw fields when specified', () => {
            const raw = {
                name: 'Charlie',
                optionalData: undefined,
                defaultConfig: { theme: 'dark', fontSize: 14 },
            };

            const result = deserialize(raw, UserWithOptionalRawField, {
                strict: true,
            });

            expect(result).toBeInstanceOf(UserWithOptionalRawField);
            expect(result.name).toBe('Charlie');
            expect(result.optionalData).toBeUndefined();
            expect(result.defaultConfig).toEqual({
                theme: 'dark',
                fontSize: 14,
            });
        });

        it('should handle null values in raw fields', () => {
            const raw = {
                name: 'David',
                metadata: null,
                settings: { setting: 'value' },
            };

            const result = deserialize(raw, UserWithRawField, { strict: true });

            expect(result).toBeInstanceOf(UserWithRawField);
            expect(result.name).toBe('David');
            expect(result.metadata).toBeNull();
            expect(result.settings).toEqual({ setting: 'value' });
        });

        it('should preserve primitive types in raw fields', () => {
            const raw = {
                name: 'Eve',
                metadata: 'just a string',
                settings: 42,
            };

            const result = deserialize(raw, UserWithRawField, { strict: true });

            expect(result).toBeInstanceOf(UserWithRawField);
            expect(result.name).toBe('Eve');
            expect(result.metadata).toBe('just a string');
            expect(result.settings).toBe(42);
        });

        it('should handle arrays in raw fields', () => {
            const raw = {
                name: 'Frank',
                metadata: ['item1', 'item2', { complex: 'object' }, 123, true],
                settings: [
                    { name: 'setting1', value: true },
                    { name: 'setting2', value: 'text' },
                    { name: 'setting3', value: [1, 2, 3] },
                ],
            };

            const result = deserialize(raw, UserWithRawField, { strict: true });

            expect(result).toBeInstanceOf(UserWithRawField);
            expect(result.name).toBe('Frank');
            expect(result.metadata).toEqual([
                'item1',
                'item2',
                { complex: 'object' },
                123,
                true,
            ]);
            expect(result.settings).toEqual([
                { name: 'setting1', value: true },
                { name: 'setting2', value: 'text' },
                { name: 'setting3', value: [1, 2, 3] },
            ]);
        });

        it('should handle undefined values in raw fields', () => {
            const raw = {
                name: 'Grace',
                metadata: undefined,
                settings: { key: undefined, otherKey: 'value' },
            };

            const result = deserialize(raw, UserWithRawField, { strict: true });

            expect(result).toBeInstanceOf(UserWithRawField);
            expect(result.name).toBe('Grace');
            expect(result.metadata).toBeUndefined();
            expect(result.settings).toEqual({
                key: undefined,
                otherKey: 'value',
            });
        });

        it('should handle deep nesting in raw fields', () => {
            const raw = {
                name: 'Henry',
                metadata: {
                    level1: {
                        level2: {
                            level3: {
                                level4: {
                                    deepValue: 'found',
                                    deepArray: [{ item: 1 }, { item: 2 }],
                                },
                            },
                        },
                    },
                },
                settings: {
                    config: {
                        nested: {
                            settings: {
                                enabled: true,
                                options: ['a', 'b', 'c'],
                            },
                        },
                    },
                },
            };

            const result = deserialize(raw, UserWithRawField, { strict: true });

            expect(result).toBeInstanceOf(UserWithRawField);
            expect(result.name).toBe('Henry');
            expect(result.metadata).toEqual({
                level1: {
                    level2: {
                        level3: {
                            level4: {
                                deepValue: 'found',
                                deepArray: [{ item: 1 }, { item: 2 }],
                            },
                        },
                    },
                },
            });
            expect(result.settings).toEqual({
                config: {
                    nested: {
                        settings: {
                            enabled: true,
                            options: ['a', 'b', 'c'],
                        },
                    },
                },
            });
        });
    });

    describe('unannotated field handling', () => {
        @SerializableObject()
        class UserWithUnannotatedFields {
            @SerializableField(() => String)
            name: string;

            @SerializableField(() => Number)
            age: number;

            // These fields should be ignored during deserialization
            internalId: string;
            tempData: object;
            privateFlag: boolean;

            constructor(name: string = '', age: number = 0) {
                this.name = name;
                this.age = age;
                this.internalId = 'default-internal';
                this.tempData = { default: true };
                this.privateFlag = true;
            }
        }

        @SerializableObject()
        class UserWithMixedFields {
            @SerializableField(() => String)
            publicName: string;

            // Unannotated field
            privateEmail: string;

            @SerializableField(() => Number, { optional: true })
            publicAge?: number;

            // Another unannotated field
            internalNotes: string[];

            @SerializableField(() => String, { defaultValue: 'user' })
            role: string;

            constructor(
                publicName: string = '',
                privateEmail: string = 'default@private.com',
                publicAge?: number,
                role: string = 'user',
            ) {
                this.publicName = publicName;
                this.privateEmail = privateEmail;
                this.publicAge = publicAge;
                this.internalNotes = ['default-note'];
                this.role = role;
            }
        }

        it('should ignore unannotated fields in raw data during deserialization', () => {
            const raw = {
                name: 'John Doe',
                age: 30,
                // These should be ignored
                internalId: 'should-be-ignored',
                tempData: { shouldNot: 'appear' },
                privateFlag: false,
                extraField: 'also-ignored',
            };

            const result = deserialize(raw, UserWithUnannotatedFields, {
                strict: true,
            });

            expect(result).toBeInstanceOf(UserWithUnannotatedFields);
            expect(result.name).toBe('John Doe');
            expect(result.age).toBe(30);

            // Unannotated fields should retain their constructor default values
            expect(result.internalId).toBe('default-internal');
            expect(result.tempData).toEqual({ default: true });
            expect(result.privateFlag).toBe(true);
        });

        it('should only deserialize annotated fields in mixed classes', () => {
            const raw = {
                publicName: 'Jane Smith',
                publicAge: 25,
                role: 'admin',
                // These should be ignored
                privateEmail: 'should-be-ignored@test.com',
                internalNotes: ['ignored', 'note'],
                extraData: 'ignored',
            };

            const result = deserialize(raw, UserWithMixedFields, {
                strict: true,
            });

            expect(result).toBeInstanceOf(UserWithMixedFields);
            expect(result.publicName).toBe('Jane Smith');
            expect(result.publicAge).toBe(25);
            expect(result.role).toBe('admin');

            // Unannotated fields should retain their constructor default values
            expect(result.privateEmail).toBe('default@private.com');
            expect(result.internalNotes).toEqual(['default-note']);
        });

        it('should handle unannotated fields with optional annotated fields', () => {
            const raw = {
                publicName: 'Bob Wilson',
                // publicAge omitted (optional)
                // role will use default value
                // These should be ignored
                privateEmail: 'ignored@test.com',
                internalNotes: ['ignored'],
                someOtherField: 'also-ignored',
            };

            const result = deserialize(raw, UserWithMixedFields, {
                strict: true,
            });

            expect(result).toBeInstanceOf(UserWithMixedFields);
            expect(result.publicName).toBe('Bob Wilson');
            expect(result.publicAge).toBeUndefined(); // optional and not provided
            expect(result.role).toBe('user'); // default value

            // Unannotated fields should retain their constructor default values
            expect(result.privateEmail).toBe('default@private.com');
            expect(result.internalNotes).toEqual(['default-note']);
        });

        it('should ignore unannotated fields even with complex structures in raw data', () => {
            const raw = {
                name: 'Complex User',
                age: 35,
                // These complex structures should be completely ignored
                tempData: {
                    nested: {
                        object: {
                            with: ['arrays', 'and', { complex: 'structures' }],
                        },
                    },
                    date: '2023-01-01T00:00:00Z',
                },
                internalId: 'complex-id-ignored',
                privateFlag: false,
                veryComplexField: [
                    { id: 1, data: { nested: true } },
                    { id: 2, data: { nested: false } },
                ],
            };

            const result = deserialize(raw, UserWithUnannotatedFields, {
                strict: true,
            });

            expect(result).toBeInstanceOf(UserWithUnannotatedFields);
            expect(result.name).toBe('Complex User');
            expect(result.age).toBe(35);

            // All unannotated fields should retain their constructor default values
            expect(result.internalId).toBe('default-internal');
            expect(result.tempData).toEqual({ default: true });
            expect(result.privateFlag).toBe(true);
        });

        it('should work correctly when raw data only contains annotated fields', () => {
            const raw = {
                name: 'Clean User',
                age: 28,
            };

            const result = deserialize(raw, UserWithUnannotatedFields, {
                strict: true,
            });

            expect(result).toBeInstanceOf(UserWithUnannotatedFields);
            expect(result.name).toBe('Clean User');
            expect(result.age).toBe(28);

            // Unannotated fields should have constructor defaults
            expect(result.internalId).toBe('default-internal');
            expect(result.tempData).toEqual({ default: true });
            expect(result.privateFlag).toBe(true);
        });
    });
});
