"""Native macOS Keychain custody; no command-line credential transport."""
from contextlib import contextmanager
import ctypes
import json
import sys


def require(condition, message):
    if not condition:
        raise ValueError(message)


class Keychain:
    """Native Keychain calls: credentials never enter argv, env or subprocess I/O."""

    def __init__(self):
        require(sys.platform == "darwin", "Credential custody requires the owner's macOS Keychain.")
        self.cf = ctypes.CDLL("/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation")
        self.sec = ctypes.CDLL("/System/Library/Frameworks/Security.framework/Security")
        pointer = ctypes.c_void_p
        self.cf.CFStringCreateWithCString.argtypes = [pointer, ctypes.c_char_p, ctypes.c_uint32]
        self.cf.CFStringCreateWithCString.restype = pointer
        self.cf.CFDataCreate.argtypes = [pointer, pointer, ctypes.c_long]
        self.cf.CFDataCreate.restype = pointer
        self.cf.CFDictionaryCreate.argtypes = [pointer, ctypes.POINTER(pointer), ctypes.POINTER(pointer),
                                             ctypes.c_long, pointer, pointer]
        self.cf.CFDictionaryCreate.restype = pointer
        self.cf.CFDataGetLength.argtypes = [pointer]
        self.cf.CFDataGetLength.restype = ctypes.c_long
        self.cf.CFDataGetBytePtr.argtypes = [pointer]
        self.cf.CFDataGetBytePtr.restype = pointer
        self.cf.CFRelease.argtypes = [pointer]
        self.cf.CFRelease.restype = None
        for function in (self.sec.SecItemAdd, self.sec.SecItemCopyMatching):
            function.argtypes = [pointer, ctypes.POINTER(pointer)]
            function.restype = ctypes.c_int32

    def constant(self, name):
        library = self.cf if name.startswith("kCF") else self.sec
        return ctypes.c_void_p.in_dll(library, name).value

    @contextmanager
    def attributes(self, service, account, *, payload=None, read=False):
        allocated = []

        def text(value):
            reference = self.cf.CFStringCreateWithCString(None, value.encode(), 0x08000100)
            require(reference, "Keychain string allocation failed.")
            allocated.append(reference)
            return reference

        dictionary = None
        try:
            attributes = [(self.constant("kSecClass"), self.constant("kSecClassGenericPassword")),
                          (self.constant("kSecAttrService"), text(service)),
                          (self.constant("kSecAttrAccount"), text(account)),
                          (self.constant("kSecAttrSynchronizable"), self.constant("kCFBooleanFalse"))]
            if read:
                attributes.extend([(self.constant("kSecReturnData"), self.constant("kCFBooleanTrue")),
                                   (self.constant("kSecMatchLimit"), self.constant("kSecMatchLimitOne"))])
            if payload is not None:
                reference = self.cf.CFDataCreate(None, payload, len(payload))
                require(reference, "Keychain data allocation failed.")
                allocated.append(reference)
                attributes.append((self.constant("kSecValueData"), reference))
            keys = (ctypes.c_void_p * len(attributes))(*(key for key, _ in attributes))
            values = (ctypes.c_void_p * len(attributes))(*(value for _, value in attributes))
            key_callbacks = ctypes.addressof(ctypes.c_char.in_dll(self.cf, "kCFTypeDictionaryKeyCallBacks"))
            value_callbacks = ctypes.addressof(ctypes.c_char.in_dll(self.cf, "kCFTypeDictionaryValueCallBacks"))
            dictionary = self.cf.CFDictionaryCreate(None, keys, values, len(attributes), key_callbacks, value_callbacks)
            require(dictionary, "Keychain dictionary allocation failed.")
            yield dictionary
        finally:
            if dictionary:
                self.cf.CFRelease(dictionary)
            for reference in allocated:
                self.cf.CFRelease(reference)

    def read(self, service, account):
        result = ctypes.c_void_p()
        with self.attributes(service, account, read=True) as attributes:
            status = self.sec.SecItemCopyMatching(attributes, ctypes.byref(result))
        if status == -25300:  # errSecItemNotFound, not any permission/unlock failure
            return None
        require(status == 0 and result.value, "Keychain retrieval refused or failed; no credentials displayed.")
        try:
            raw = ctypes.string_at(self.cf.CFDataGetBytePtr(result), self.cf.CFDataGetLength(result))
            return json.loads(raw)
        except (ValueError, UnicodeError):
            raise ValueError("Protected Keychain custody is invalid; no credential detail retained.") from None
        finally:
            self.cf.CFRelease(result)

    def create(self, service, account, credential):
        payload = json.dumps(credential, separators=(",", ":")).encode()
        with self.attributes(service, account, payload=payload) as attributes:
            status = self.sec.SecItemAdd(attributes, None)
        require(status == 0, "Keychain creation refused or failed; existing items are never overwritten.")
