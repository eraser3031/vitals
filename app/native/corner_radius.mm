#include <napi.h>
#import <Cocoa/Cocoa.h>
#import <QuartzCore/QuartzCore.h>
#import <objc/runtime.h>

static IMP g_originalCornerMask = nullptr;
static CGFloat g_cornerRadius = 10.0;
static BOOL g_swizzled = NO;

static id swizzled_cornerMask(id self, SEL _cmd) {
    NSView *view = (NSView *)self;
    NSRect bounds = [view bounds];
    return [NSBezierPath bezierPathWithRoundedRect:bounds
                                          xRadius:g_cornerRadius
                                          yRadius:g_cornerRadius];
}

Napi::Value SetCornerRadius(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();

    if (info.Length() < 2) {
        Napi::TypeError::New(env, "Expected (handle, radius)")
            .ThrowAsJavaScriptException();
        return env.Null();
    }

    Napi::Buffer<uint8_t> buf = info[0].As<Napi::Buffer<uint8_t>>();
    double radius = info[1].As<Napi::Number>().DoubleValue();
    g_cornerRadius = (CGFloat)radius;

    NSView *nsView =
        *reinterpret_cast<NSView *__unsafe_unretained *>(buf.Data());
    NSWindow *nsWindow = [nsView window];

    if (!nsWindow) {
        NSLog(@"[CornerRadius] ERROR: nsWindow is nil");
        return Napi::Boolean::New(env, false);
    }

    NSLog(@"[CornerRadius] Window found: %@", nsWindow);
    NSLog(@"[CornerRadius] Window class: %s", class_getName([nsWindow class]));

    // --- Approach 1: _cornerMask swizzle on theme frame ---
    NSView *themeFrame = [[nsWindow contentView] superview];
    if (themeFrame) {
        Class themeFrameClass = [themeFrame class];
        NSLog(@"[CornerRadius] Theme frame class: %s",
              class_getName(themeFrameClass));

        SEL cornerMaskSel = NSSelectorFromString(@"_cornerMask");

        if (!g_swizzled) {
            Method existing =
                class_getInstanceMethod(themeFrameClass, cornerMaskSel);
            if (existing) {
                NSLog(@"[CornerRadius] Swizzling existing _cornerMask");
                g_originalCornerMask = method_setImplementation(
                    existing, (IMP)swizzled_cornerMask);
            } else {
                NSLog(@"[CornerRadius] Adding _cornerMask method");
                class_addMethod(themeFrameClass, cornerMaskSel,
                                (IMP)swizzled_cornerMask, "@@:");
            }
            g_swizzled = YES;
        }
    }

    // --- Approach 2: CALayer cornerRadius on theme frame ---
    if (themeFrame) {
        [themeFrame setWantsLayer:YES];
        themeFrame.layer.cornerRadius = g_cornerRadius;
        themeFrame.layer.masksToBounds = YES;
        NSLog(@"[CornerRadius] Set CALayer cornerRadius=%.0f on theme frame",
              g_cornerRadius);
    }

    // --- Approach 3: Try _setCornerRadius: on NSWindow ---
    SEL setCornerRadiusSel = NSSelectorFromString(@"_setCornerRadius:");
    if ([nsWindow respondsToSelector:setCornerRadiusSel]) {
        NSLog(@"[CornerRadius] NSWindow responds to _setCornerRadius:");
        NSMethodSignature *sig =
            [nsWindow methodSignatureForSelector:setCornerRadiusSel];
        NSInvocation *inv =
            [NSInvocation invocationWithMethodSignature:sig];
        [inv setSelector:setCornerRadiusSel];
        [inv setTarget:nsWindow];
        CGFloat r = g_cornerRadius;
        [inv setArgument:&r atIndex:2];
        [inv invoke];
    } else {
        NSLog(@"[CornerRadius] NSWindow does NOT respond to "
              @"_setCornerRadius:");
    }

    // --- Approach 4: contentView layer ---
    NSView *contentView = [nsWindow contentView];
    if (contentView) {
        [contentView setWantsLayer:YES];
        contentView.layer.cornerRadius = g_cornerRadius;
        contentView.layer.masksToBounds = YES;
        NSLog(@"[CornerRadius] Set CALayer cornerRadius=%.0f on contentView",
              g_cornerRadius);
    }

    // Force redraw
    [nsWindow display];
    [nsWindow invalidateShadow];

    NSLog(@"[CornerRadius] All approaches applied with radius=%.0f",
          g_cornerRadius);

    return Napi::Boolean::New(env, true);
}

Napi::Value ResetCornerRadius(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();

    Napi::Buffer<uint8_t> buf = info[0].As<Napi::Buffer<uint8_t>>();
    NSView *nsView =
        *reinterpret_cast<NSView *__unsafe_unretained *>(buf.Data());
    NSWindow *nsWindow = [nsView window];

    if (!nsWindow) {
        return Napi::Boolean::New(env, false);
    }

    NSView *themeFrame = [[nsWindow contentView] superview];

    if (g_swizzled && g_originalCornerMask && themeFrame) {
        Class themeFrameClass = [themeFrame class];
        SEL cornerMaskSel = NSSelectorFromString(@"_cornerMask");
        Method method =
            class_getInstanceMethod(themeFrameClass, cornerMaskSel);
        if (method) {
            method_setImplementation(method, g_originalCornerMask);
        }
        g_swizzled = NO;
        g_originalCornerMask = nullptr;
    }

    if (themeFrame) {
        themeFrame.layer.cornerRadius = 0;
        themeFrame.layer.masksToBounds = NO;
    }

    NSView *contentView = [nsWindow contentView];
    if (contentView) {
        contentView.layer.cornerRadius = 0;
        contentView.layer.masksToBounds = NO;
    }

    [nsWindow display];
    [nsWindow invalidateShadow];

    return Napi::Boolean::New(env, true);
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("setCornerRadius",
                Napi::Function::New(env, SetCornerRadius));
    exports.Set("resetCornerRadius",
                Napi::Function::New(env, ResetCornerRadius));
    return exports;
}

NODE_API_MODULE(corner_radius, Init)
