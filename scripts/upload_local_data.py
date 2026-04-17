import os
import base64
import requests
import pandas as pd
import time

# 配置
API_URL = "https://3000-iy2ya0ctfj4nge1hdrlw9-589bb272.sg1.manus.computer/api/upload"
DATA_DIR = r"C:\Users\wyn\Desktop\ifind数据\ifind_data\ifind_output"

def upload_file(file_path):
    filename = os.path.basename(file_path)
    with open(file_path, "rb") as f:
        content = base64.b64encode(f.read()).decode("utf-8")
    
    payload = {
        "filename": filename,
        "content": content,
        "contentType": "application/octet-stream"
    }
    
    try:
        response = requests.post(API_URL, json=payload)
        if response.status_code == 200:
            print(f"Successfully uploaded {filename}: {response.json()}")
        else:
            print(f"Failed to upload {filename}: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"Error uploading {filename}: {e}")

def main():
    # 示例：上传目录下所有的 csv 和 xlsx 文件
    # 在实际使用中，您可以根据需要修改逻辑，比如只上传最新的文件
    if not os.path.exists(DATA_DIR):
        print(f"Directory not found: {DATA_DIR}")
        # 为了演示，我们尝试列出当前目录下的文件
        return

    files = [f for f in os.listdir(DATA_DIR) if f.endswith(('.csv', '.xlsx', '.xls'))]
    for file in files:
        upload_file(os.path.join(DATA_DIR, file))

if __name__ == "__main__":
    print(f"Starting upload to {API_URL}...")
    # main()
    print("Please run this script on your local machine.")
