#!/bin/bash

ECHOO_MODULE_BUILD_PATH=../artifacts/contracts
TRUSTLIST_BUILD_PATH=../artifacts/contracts/trustlists_contracts
S3_ABI_LOCAL_PATH=../artifacts/s3_abi
S3_BUILD_LOCAL_PATH=../artifacts/s3_build
CONFIG_BUILD_PATH=../artifacts/config

mkdir $S3_ABI_LOCAL_PATH
mkdir $S3_BUILD_LOCAL_PATH
mkdir $CONFIG_BUILD_PATH

# Prepare abi data
cat $ECHOO_MODULE_BUILD_PATH/modules/EchoooModule.sol/EchoooModule.json | jq '{abi: .abi}' > $S3_ABI_LOCAL_PATH/EchoooModule_abi.json
cp $ECHOO_MODULE_BUILD_PATH/modules/EchoooModule.sol/EchoooModule.json $S3_BUILD_LOCAL_PATH/
cat $ECHOO_MODULE_BUILD_PATH/infrastructure/WalletFactory.sol/WalletFactory.json | jq '{abi: .abi}' > $S3_ABI_LOCAL_PATH/WalletFactory_abi.json
cp $ECHOO_MODULE_BUILD_PATH/infrastructure/WalletFactory.sol/WalletFactory.json $S3_BUILD_LOCAL_PATH/
cat $ECHOO_MODULE_BUILD_PATH/infrastructure/IModuleRegistry.sol/IModuleRegistry.json | jq '{abi: .abi}' > $S3_ABI_LOCAL_PATH/IModuleRegistry_abi.json
cp $ECHOO_MODULE_BUILD_PATH/infrastructure/IModuleRegistry.sol/IModuleRegistry.json $S3_BUILD_LOCAL_PATH/
cat $ECHOO_MODULE_BUILD_PATH/infrastructure_0.5/ModuleRegistry.sol/ModuleRegistry.json | jq '{abi:.abi}' > $S3_ABI_LOCAL_PATH/ModuleRegistry_abi.json
cp $ECHOO_MODULE_BUILD_PATH/infrastructure_0.5/ModuleRegistry.sol/ModuleRegistry.json $S3_BUILD_LOCAL_PATH/ 
cat $ECHOO_MODULE_BUILD_PATH/wallet/BaseWallet.sol/BaseWallet.json | jq '{abi: .abi}' > $S3_ABI_LOCAL_PATH/BaseWallet_abi.json
cp $ECHOO_MODULE_BUILD_PATH/wallet/BaseWallet.sol/BaseWallet.json $S3_BUILD_LOCAL_PATH/
cat $ECHOO_MODULE_BUILD_PATH/wallet/Proxy.sol/Proxy.json | jq '{abi: .abi}' > $S3_ABI_LOCAL_PATH/Proxy_abi.json
cp $ECHOO_MODULE_BUILD_PATH/wallet/Proxy.sol/Proxy.json $S3_BUILD_LOCAL_PATH/ 
cat $ECHOO_MODULE_BUILD_PATH/wallet/IWallet.sol/IWallet.json | jq '{abi: .abi}' > $S3_ABI_LOCAL_PATH/IWallet_abi.json
cp $ECHOO_MODULE_BUILD_PATH/wallet/IWallet.sol/IWallet.json $S3_BUILD_LOCAL_PATH/
cat $TRUSTLIST_BUILD_PATH/DappRegistry.sol/DappRegistry.json | jq '{abi: .abi}' > $S3_ABI_LOCAL_PATH/DappRegistry_abi.json
cp $TRUSTLIST_BUILD_PATH/DappRegistry.sol/DappRegistry.json $S3_BUILD_LOCAL_PATH/
cat $TRUSTLIST_BUILD_PATH/TokenRegistry.sol/TokenRegistry.json | jq '{abi: .abi}' > $S3_ABI_LOCAL_PATH/TokenRegistry_abi.json
cp $TRUSTLIST_BUILD_PATH/TokenRegistry.sol/TokenRegistry.json $S3_BUILD_LOCAL_PATH/


S3UPLOAD_BUCKET=s3://echooo-builds
S3UPLOAD_FOLDER=`date '+%Y%m%d%H%M%S'`
S3UPLOAD_ABI_FOLDER=$S3UPLOAD_BUCKET/$S3UPLOAD_FOLDER/abi/
S3UPLOAD_CONFIG_FOLDER=$S3UPLOAD_BUCKET/$S3UPLOAD_FOLDER/config/
S3UPLOAD_ECHOOO_MODULE_FOLDER=$S3UPLOAD_BUCKET/$S3UPLOAD_FOLDER/build/

#Upload the abi
echo Upload ABI to $S3UPLOAD_ABI_FOLDER
aws s3 cp --recursive $S3_ABI_LOCAL_PATH $S3UPLOAD_ABI_FOLDER

#Upload the config file
echo Upload config files to $S3UPLOAD_FOLDER
aws s3 cp --recursive $CONFIG_BUILD_PATH $S3UPLOAD_CONFIG_FOLDER

#Upload the build artifacts
echo Upload build artifacts to $S3UPLOAD_ECHOOO_MODULE_FOLDER
aws s3 cp --recursive $S3_BUILD_LOCAL_PATH $S3UPLOAD_ECHOOO_MODULE_FOLDER

rm -rf  $S3_ABI_LOCAL_PATH
rm -rf  $S3_BUILD_LOCAL_PATH
rm -rf  $CONFIG_BUILD_PATH
