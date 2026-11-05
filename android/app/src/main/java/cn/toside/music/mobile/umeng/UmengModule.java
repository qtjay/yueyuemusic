package cn.toside.music.mobile.umeng;

import android.content.Context;
import android.content.SharedPreferences;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.umeng.analytics.MobclickAgent;
import com.umeng.commonsdk.UMConfigure;

import java.util.HashMap;
import java.util.Map;

import cn.toside.music.mobile.BuildConfig;

/** 友盟移动统计：合规预初始化 + 用户同意后正式初始化 + RN 页面/事件埋点桥接 */
public class UmengModule extends ReactContextBaseJavaModule {
  public static final String APP_KEY = "6aecbc48863270068cb713f4";
  public static final String CHANNEL = "default";
  private static final String PREF_NAME = "umeng_privacy";
  private static final String KEY_GRANTED = "policy_granted";

  public UmengModule(ReactApplicationContext reactContext) {
    super(reactContext);
  }

  @Override
  public String getName() {
    return "UmengAnalytics";
  }

  private static SharedPreferences prefs(Context context) {
    return context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
  }

  public static boolean isGranted(Context context) {
    return prefs(context).getBoolean(KEY_GRANTED, false);
  }

  /** Application.onCreate 调用：preInit 不采集不联网；已授权则直接正式初始化 */
  public static void preInit(Context context) {
    UMConfigure.preInit(context, APP_KEY, CHANNEL);
    if (isGranted(context)) initUmeng(context);
  }

  private static void initUmeng(Context context) {
    UMConfigure.init(context, APP_KEY, CHANNEL, UMConfigure.DEVICE_TYPE_PHONE, "");
    UMConfigure.setLogEnabled(BuildConfig.DEBUG);
    // RN 只有一个 Activity，页面访问由 JS 手动调用 onPageStart/onPageEnd 上报
  }

  /** 用户在首次启动协议弹窗点击「接受」后调用 */
  @ReactMethod
  public void grantPrivacy(Promise promise) {
    Context context = getReactApplicationContext();
    if (!isGranted(context)) {
      prefs(context).edit().putBoolean(KEY_GRANTED, true).apply();
      initUmeng(context);
    }
    promise.resolve(true);
  }

  @ReactMethod
  public void isPrivacyGranted(Promise promise) {
    promise.resolve(isGranted(getReactApplicationContext()));
  }

  @ReactMethod
  public void onPageStart(String pageName) {
    if (isGranted(getReactApplicationContext())) MobclickAgent.onPageStart(pageName);
  }

  @ReactMethod
  public void onPageEnd(String pageName) {
    if (isGranted(getReactApplicationContext())) MobclickAgent.onPageEnd(pageName);
  }

  @ReactMethod
  public void onEvent(String eventId, ReadableMap attributes) {
    if (!isGranted(getReactApplicationContext())) return;
    Map<String, Object> map = new HashMap<>();
    if (attributes != null) map.putAll(attributes.toHashMap());
    MobclickAgent.onEventObject(getReactApplicationContext(), eventId, map);
  }
}
